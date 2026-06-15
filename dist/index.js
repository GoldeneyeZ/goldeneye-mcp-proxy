#!/usr/bin/env node
/**
 * index.ts — Entry point for goldeneye-mcp-proxy.
 *
 * Usage:
 *   node dist/index.js [path-to-config.json]          (stdio mode, default)
 *   node dist/index.js --port 8767 [path-to-config.json]  (HTTP daemon mode)
 *   node dist/index.js --daemon [path-to-config.json]     (alias for --port 8767)
 *
 * If no config path is provided, reads from:
 *   1. MCP_GATEWAY_CONFIG env var
 *   2. ~/.config/goldeneye-mcp-proxy/config.json
 *
 * Stdio mode (for backwards compatibility):
 *   The gateway speaks MCP over stdin/stdout.
 *   Use this from pi's mcp config as "type": "local", "command": [...]
 *
 * HTTP daemon mode (recommended for shared use):
 *   The gateway binds to an HTTP port and speaks MCP's Streamable HTTP
 *   transport (JSON-RPC 2.0). Multiple clients can connect via:
 *     - pi:     url in .vscode/mcp.json or pi-mcp-adapter config
 *     - VS Code: "type": "streamableHttp", "url": "http://localhost:PORT/mcp"
 *   Only ONE process spawns all upstream MCP servers, eliminating duplicate
 *   npm exec processes across sessions.
 */
import { MCPGateway } from "./gateway/MCPGateway.js";
import { HttpMcpServer } from "./transports/http/HttpMcpServer.js";
import { SkillMigrationService } from "./skills/SkillMigrationService.js";
// Parse CLI arguments
let configPath;
let port;
let discoverMode = false;
let helpMode = false;
let deferCodexSkills = false;
let restoreCodexSkills = false;
let deferAgentsSkills = false;
let restoreAgentsSkills = false;
let dryRun = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && i + 1 < args.length) {
        port = parseInt(args[++i], 10);
    }
    else if (args[i] === "--daemon") {
        port = 8767;
    }
    else if (args[i] === "--discover") {
        discoverMode = true;
    }
    else if (args[i] === "--defer-codex-skills") {
        deferCodexSkills = true;
    }
    else if (args[i] === "--restore-codex-skills") {
        restoreCodexSkills = true;
    }
    else if (args[i] === "--defer-agents-skills") {
        deferAgentsSkills = true;
    }
    else if (args[i] === "--restore-agents-skills") {
        restoreAgentsSkills = true;
    }
    else if (args[i] === "--dry-run") {
        dryRun = true;
    }
    else if (args[i] === "--help" || args[i] === "-h") {
        helpMode = true;
    }
    else if (!args[i].startsWith("--")) {
        configPath = args[i];
    }
}
if (helpMode) {
    printUsage();
}
else if (deferCodexSkills || restoreCodexSkills || deferAgentsSkills || restoreAgentsSkills) {
    runSkillMigration({
        deferCodexSkills,
        restoreCodexSkills,
        deferAgentsSkills,
        restoreAgentsSkills,
        dryRun,
    });
}
else if (discoverMode) {
    runDiscovery(configPath);
}
else if (port) {
    // ── HTTP daemon mode ──
    // Start the gateway, connect to all upstream MCP servers,
    // then serve the same 6 gateway tools over HTTP.
    startDaemon(configPath, port);
}
else {
    // ── Stdio mode (original behavior) ──
    startStdio(configPath);
}
function printUsage() {
    console.log(`Usage:
  goldeneye-mcp-proxy [path-to-config.json]
  goldeneye-mcp-proxy --port <port> [path-to-config.json]
  goldeneye-mcp-proxy --daemon [path-to-config.json]
  goldeneye-mcp-proxy --discover [path-to-config.json]
  goldeneye-mcp-proxy --defer-codex-skills [--dry-run]
  goldeneye-mcp-proxy --restore-codex-skills [--dry-run]
  goldeneye-mcp-proxy --defer-agents-skills [--dry-run]
  goldeneye-mcp-proxy --restore-agents-skills [--dry-run]
  goldeneye-mcp-proxy --help

Options:
  --port <port>  Start HTTP daemon mode on the given port.
  --daemon       Start HTTP daemon mode on port 8767.
  --discover     Force catalog discovery, save snapshots, and exit.
  --defer-codex-skills    Rename ~/.codex/skills to ~/.codex/skills.deferred.
  --restore-codex-skills  Restore ~/.codex/skills.deferred to ~/.codex/skills.
  --defer-agents-skills    Rename ~/.agents/skills to ~/.agents/skills.deferred.
  --restore-agents-skills  Restore ~/.agents/skills.deferred to ~/.agents/skills.
  --dry-run       Show migration changes without mutating files.
  --help, -h     Print this help text and exit.`);
}
function runSkillMigration(options) {
    const selected = [
        options.deferCodexSkills,
        options.restoreCodexSkills,
        options.deferAgentsSkills,
        options.restoreAgentsSkills,
    ].filter(Boolean).length;
    if (selected !== 1) {
        console.error("Use exactly one skill migration flag");
        process.exit(1);
    }
    const service = new SkillMigrationService();
    try {
        const result = options.deferCodexSkills
            ? service.deferCodexSkills({ dryRun: options.dryRun })
            : options.restoreCodexSkills
                ? service.restoreCodexSkills({ dryRun: options.dryRun })
                : options.deferAgentsSkills
                    ? service.deferAgentsSkills({ dryRun: options.dryRun })
                    : service.restoreAgentsSkills({ dryRun: options.dryRun });
        console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}
function startStdio(configPath) {
    const gateway = new MCPGateway(configPath);
    process.on("SIGINT", () => {
        gateway.shutdown().then(() => process.exit(0));
    });
    process.on("SIGTERM", () => {
        gateway.shutdown().then(() => process.exit(0));
    });
    process.on("uncaughtException", (err) => {
        console.error(`  [proxy] Uncaught exception: ${err.message}`);
    });
    process.on("unhandledRejection", (reason) => {
        console.error(`  [proxy] Unhandled rejection: ${reason}`);
    });
    gateway.startWithStdio().catch((err) => {
        console.error(`  [proxy] Fatal error: ${err.message}`);
        process.exit(1);
    });
}
async function startDaemon(configPath, daemonPort) {
    const gateway = new MCPGateway(configPath);
    // Connect to all upstream MCP servers first
    console.error("  [daemon] Starting in HTTP daemon mode...");
    await gateway.connectAll();
    // Create HTTP server sharing the same services
    const services = gateway.getSharedServices();
    const httpServer = new HttpMcpServer(services.searchEngine, services.connections, services.toolService, daemonPort, services.skillService);
    // Register signal handlers now that httpServer is defined
    process.on("SIGINT", async () => {
        await httpServer.shutdown();
        await gateway.shutdown();
        process.exit(0);
    });
    process.on("SIGTERM", async () => {
        await httpServer.shutdown();
        await gateway.shutdown();
        process.exit(0);
    });
    process.on("uncaughtException", (err) => {
        console.error(`  [proxy] Uncaught exception: ${err.message}`);
    });
    process.on("unhandledRejection", (reason) => {
        console.error(`  [proxy] Unhandled rejection: ${reason}`);
    });
    // Start the HTTP server
    await httpServer.start();
    console.error(`  [daemon] goldeneye-mcp-proxy daemon ready on port ${daemonPort}`);
}
async function runDiscovery(configPath) {
    const gateway = new MCPGateway(configPath);
    console.error("  [discover] Running catalog discovery...");
    await gateway.connectAll(true); // force-connect all servers to build snapshots
    // Give a moment for snapshots to be written
    await new Promise((r) => setTimeout(r, 500));
    await gateway.shutdown();
    console.error("  [discover] Catalog snapshots saved. Exiting.");
    process.exit(0);
}
// Also expose classes for programmatic usage
export { MCPGateway, HttpMcpServer };
//# sourceMappingURL=index.js.map