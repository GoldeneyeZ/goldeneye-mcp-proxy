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
export { MCPGateway, HttpMcpServer };
