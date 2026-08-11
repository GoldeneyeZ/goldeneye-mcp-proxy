import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error Native Node TypeScript execution requires the source extension.
import { createJsonServer } from "./helpers/cli-http-server.ts";

const entrypoint = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const processDeadlineMs = 10_000;

interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface LegacyFixture {
  configPath: string;
  env: NodeJS.ProcessEnv;
  home: string;
}

function runEntrypoint(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [entrypoint, ...args], { encoding: "utf8", env, timeout: processDeadlineMs }, (error, stdout, stderr) => {
      if (error && error.code === undefined) {
        reject(error);
        return;
      }
      resolve({
        code: error && typeof error.code === "number" ? error.code : 0,
        stdout,
        stderr,
      });
    });
  });
}

function createLegacyFixture(): LegacyFixture {
  const home = mkdtempSync(join(tmpdir(), "goldeneye-cli-legacy-"));
  const configPath = join(home, "config.json");
  writeFileSync(configPath, "{}\n", "utf8");
  return {
    configPath,
    env: { ...process.env, HOME: home, MCP_GATEWAY_CONFIG: configPath },
    home,
  };
}

function removeLegacyFixture(fixture: LegacyFixture): void {
  rmSync(fixture.home, { recursive: true, force: true });
}

function observeRunningEntrypoint(
  args: string[],
  env: NodeJS.ProcessEnv,
  isObserved: (stdout: string, stderr: string) => boolean,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let observed = false;
    let forceKill: NodeJS.Timeout | undefined;

    const deadline = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Entrypoint observation timed out. stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr)}`));
    }, processDeadlineMs);

    const check = () => {
      if (observed || !isObserved(stdout, stderr)) return;
      observed = true;
      clearTimeout(deadline);
      child.kill("SIGTERM");
      forceKill = setTimeout(() => child.kill("SIGKILL"), 500);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      stdout += chunk;
      check();
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
      check();
    });
    child.once("error", error => {
      clearTimeout(deadline);
      if (forceKill) clearTimeout(forceKill);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(deadline);
      if (forceKill) clearTimeout(forceKill);
      if (!observed) {
        reject(new Error(`Entrypoint exited before observation (${code ?? signal}). stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Test port server has no TCP address"));
        return;
      }
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

test("built entrypoint dispatches search and writes one compact JSON line", async () => {
  const server = await createJsonServer(body => {
    assert.deepEqual(body, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "gateway.search",
        arguments: { query: "database", limit: 2 },
      },
    });
    return {
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: '{"found":1,"results":[]}' }] },
    };
  });

  try {
    const result = await runEntrypoint([
      "search", "database", "--limit", "2", "--url", server.url,
    ]);
    assert.deepEqual(result, {
      code: 0,
      stdout: '{"found":1,"results":[]}\n',
      stderr: "",
    });
  } finally {
    await server.close();
  }
});

test("built entrypoint reports invalid gateway CLI input on stderr", async () => {
  const result = await runEntrypoint(["search"]);

  assert.deepEqual(result, {
    code: 2,
    stdout: "",
    stderr: '{"error":{"code":"INVALID_ARGS","message":"Missing positional argument for search"}}\n',
  });
});

test("built entrypoint rejects malformed and unsupported resolved endpoints without leaking them", async () => {
  const cases = [
    {
      args: ["search", "database", "--url", "not-a-url?token=FLAG_SECRET_7391"],
      env: process.env,
    },
    {
      args: ["search", "database", "--url", "file:///tmp/FLAG_SECRET_7391.sock"],
      env: process.env,
    },
    {
      args: ["search", "database"],
      env: { ...process.env, MCP_GATEWAY_URL: "malformed?token=ENV_SECRET_7391" },
    },
    {
      args: ["search", "database"],
      env: { ...process.env, MCP_GATEWAY_URL: "ftp://user:ENV_SECRET_7391@example.test/mcp?token=query-secret" },
    },
  ];

  for (const testCase of cases) {
    const result = await runEntrypoint(testCase.args, testCase.env);
    assert.deepEqual(result, {
      code: 2,
      stdout: "",
      stderr: '{"error":{"code":"INVALID_ARGS","message":"Gateway URL must be an absolute http: or https: URL"}}\n',
    });
    assert.doesNotMatch(result.stderr, /FLAG_SECRET_7391|ENV_SECRET_7391|query-secret|example\.test|malformed/);
  }
});

test("built entrypoint rejects unknown and malformed legacy options before stdio startup", async () => {
  const cases = [
    { args: ["--wat"], message: "Unknown legacy option" },
    { args: ["--port"], message: "Missing value for --port" },
    { args: ["--port", "not-a-port"], message: "Invalid value for --port" },
    { args: ["--port", "0"], message: "Invalid value for --port" },
    { args: ["--port", "65536"], message: "Invalid value for --port" },
  ];

  for (const testCase of cases) {
    const result = await runEntrypoint(testCase.args);
    assert.deepEqual(result, {
      code: 2,
      stdout: "",
      stderr: `${JSON.stringify({ error: { code: "INVALID_ARGS", message: testCase.message } })}\n`,
    }, testCase.args.join(" "));
    assert.doesNotMatch(result.stderr, /__MCP_GATEWAY_STDIO_READY__|starting \(stdio\)|\[proxy\]/);
  }
});

test("built entrypoint does not echo supplied JSON in parser errors", async () => {
  const suppliedJson = '{"password":"TOP_SECRET_7391"}';
  const result = await runEntrypoint(["invoke", "srv::tool", suppliedJson]);

  assert.deepEqual(result, {
    code: 2,
    stdout: "",
    stderr: '{"error":{"code":"INVALID_ARGS","message":"Unexpected positional argument"}}\n',
  });
  assert.doesNotMatch(result.stderr, /TOP_SECRET_7391/);
  assert.doesNotMatch(result.stderr, /\{"password"/);
});

test("built entrypoint help retains legacy modes and lists all gateway commands", async () => {
  const result = await runEntrypoint(["--help"]);

  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  for (const legacyOption of [
    "--port", "--daemon", "--discover", "--defer-codex-skills",
    "--restore-codex-skills", "--defer-agents-skills", "--restore-agents-skills",
    "--dry-run",
  ]) {
    assert.match(result.stdout, new RegExp(legacyOption));
  }
  for (const command of [
    "search", "describe", "invoke", "invoke-async", "invoke-status", "get-result",
  ]) {
    assert.match(result.stdout, new RegExp(`goldeneye-mcp-proxy ${command}(?: |\\n)`));
  }
});

test("built entrypoint keeps no-argument and config-path stdio dispatch reachable", async () => {
  const fixture = createLegacyFixture();
  try {
    const noArgument = await observeRunningEntrypoint([], fixture.env, (stdout, stderr) =>
      stdout.includes("__MCP_GATEWAY_STDIO_READY__") && stderr.includes("starting (stdio)"),
    );
    assert.match(noArgument.stderr, new RegExp(`Loaded 0 server\\(s\\) from ${fixture.configPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));

    const explicitConfigPath = join(fixture.home, "explicit-config.json");
    writeFileSync(explicitConfigPath, "{}\n", "utf8");
    const explicitConfig = await observeRunningEntrypoint([explicitConfigPath], fixture.env, (stdout, stderr) =>
      stdout.includes("__MCP_GATEWAY_STDIO_READY__") && stderr.includes("starting (stdio)"),
    );
    assert.match(explicitConfig.stderr, new RegExp(`Loaded 0 server\\(s\\) from ${explicitConfigPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  } finally {
    removeLegacyFixture(fixture);
  }
});

test("built entrypoint keeps --daemon and --port HTTP dispatch reachable", async () => {
  const fixture = createLegacyFixture();
  try {
    const daemon = await observeRunningEntrypoint(["--daemon", fixture.configPath], fixture.env, (_stdout, stderr) =>
      stderr.includes("[daemon] Starting in HTTP daemon mode"),
    );
    assert.doesNotMatch(daemon.stderr, /"error":\{"code":"INVALID_ARGS"/);

    const port = await getAvailablePort();
    const explicitPort = await observeRunningEntrypoint(["--port", String(port), fixture.configPath], fixture.env, (_stdout, stderr) =>
      stderr.includes(`daemon ready on port ${port}`),
    );
    assert.match(explicitPort.stderr, /\[daemon\] Starting in HTTP daemon mode/);
  } finally {
    removeLegacyFixture(fixture);
  }
});

test("built entrypoint keeps --discover dispatch reachable", async () => {
  const fixture = createLegacyFixture();
  try {
    const result = await runEntrypoint(["--discover", fixture.configPath], fixture.env);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /\[discover\] Running catalog discovery/);
    assert.match(result.stderr, /\[discover\] Catalog snapshots saved\. Exiting\./);
  } finally {
    removeLegacyFixture(fixture);
  }
});

test("built entrypoint keeps every skill-migration dispatch reachable", async () => {
  const modes = [
    { flag: "--defer-codex-skills", directory: join(".codex", "skills"), message: "Would rename" },
    { flag: "--restore-codex-skills", directory: join(".codex", "skills.deferred"), message: "Would restore" },
    { flag: "--defer-agents-skills", directory: join(".agents", "skills"), message: "Would rename" },
    { flag: "--restore-agents-skills", directory: join(".agents", "skills.deferred"), message: "Would restore" },
  ];

  for (const mode of modes) {
    const fixture = createLegacyFixture();
    try {
      mkdirSync(join(fixture.home, mode.directory), { recursive: true });
      const result = await runEntrypoint([mode.flag, "--dry-run"], fixture.env);
      assert.equal(result.code, 0, mode.flag);
      assert.equal(result.stderr, "", mode.flag);
      const payload = JSON.parse(result.stdout) as { changed: boolean; message: string };
      assert.equal(payload.changed, false, mode.flag);
      assert.match(payload.message, new RegExp(`^${mode.message} `), mode.flag);
    } finally {
      removeLegacyFixture(fixture);
    }
  }
});
