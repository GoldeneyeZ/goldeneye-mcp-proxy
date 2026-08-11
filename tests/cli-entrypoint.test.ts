import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
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

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function waitForRecordedPid(pidPath: string, timeoutMs = 2_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const pid = Number.parseInt(readFileSync(pidPath, "utf8"), 10);
      if (Number.isSafeInteger(pid) && pid > 0) return pid;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Fake systemctl did not record its PID");
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

async function createHangingHealthServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const sockets = new Set<import("node:net").Socket>();
  const server = createHttpServer((req) => {
    if (req.url === "/mcp") {
      req.socket.destroy();
    }
    // Deliberately leave /health open forever. Recovery must abort the request.
  });
  server.on("connection", socket => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Hanging health server has no TCP address");
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () => new Promise<void>((resolve, reject) => {
      for (const socket of sockets) socket.destroy();
      server.close(error => error ? reject(error) : resolve());
    }),
  };
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

test("built entrypoint bounds a health endpoint that accepts but never responds", async () => {
  const server = await createHangingHealthServer();
  const startedAt = Date.now();
  try {
    const result = await runEntrypoint(["search", "database", "--url", server.url]);
    assert.deepEqual(result, {
      code: 3,
      stdout: "",
      stderr: '{"error":{"code":"DAEMON_UNAVAILABLE","message":"Gateway daemon is unavailable"}}\n',
    });
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs >= 4_500, `recovery returned too early after ${elapsedMs}ms`);
    assert.ok(elapsedMs < 7_500, `recovery exceeded its bounded window: ${elapsedMs}ms`);
  } finally {
    await server.close();
  }
});

test("built entrypoint reaps a timed-out systemctl child that ignores SIGTERM", async (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "goldeneye-cli-systemctl-"));
  const systemctlPath = join(fixture, "systemctl");
  const pidPath = join(fixture, "pid");
  const port = await getAvailablePort();
  let recordedPid: number | undefined;

  writeFileSync(systemctlPath, `#!${process.execPath}\nconst { writeFileSync } = require("node:fs");\nwriteFileSync(process.env.FAKE_SYSTEMCTL_PID_PATH, String(process.pid));\nprocess.on("SIGTERM", () => {});\nsetInterval(() => {}, 1000);\n`, "utf8");
  chmodSync(systemctlPath, 0o755);

  const startedAt = Date.now();
  try {
    const resultPromise = runEntrypoint(
      ["search", "database", "--url", `http://127.0.0.1:${port}/mcp`],
      {
        ...process.env,
        PATH: `${fixture}:${process.env.PATH ?? ""}`,
        FAKE_SYSTEMCTL_PID_PATH: pidPath,
      },
    );
    recordedPid = await waitForRecordedPid(pidPath);
    const result = await resultPromise;

    assert.deepEqual(result, {
      code: 3,
      stdout: "",
      stderr: '{"error":{"code":"DAEMON_UNAVAILABLE","message":"Gateway daemon is unavailable"}}\n',
    });
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs >= 4_500, `recovery returned too early after ${elapsedMs}ms`);
    assert.ok(elapsedMs < 7_500, `recovery exceeded its bounded cleanup window: ${elapsedMs}ms`);
    assert.equal(processExists(recordedPid), false, `systemctl PID ${recordedPid} still exists`);
    t.diagnostic(`elapsed=${elapsedMs}ms systemctlPid=${recordedPid} aliveAfterCli=false`);
  } finally {
    if (recordedPid === undefined) {
      try {
        const pid = Number.parseInt(readFileSync(pidPath, "utf8"), 10);
        if (Number.isSafeInteger(pid) && pid > 0) recordedPid = pid;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (recordedPid !== undefined && processExists(recordedPid)) {
      try {
        process.kill(recordedPid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    rmSync(fixture, { recursive: true, force: true });
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
    { args: ["-wat"], message: "Unknown legacy option" },
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

test("built entrypoint help aliases retain legacy modes and list all gateway commands", async () => {
  for (const helpAlias of ["--help", "-h"]) {
    const result = await runEntrypoint([helpAlias]);

    assert.equal(result.code, 0, helpAlias);
    assert.equal(result.stderr, "", helpAlias);
    for (const legacyOption of [
      "--port", "--daemon", "--discover", "--defer-codex-skills",
      "--restore-codex-skills", "--defer-agents-skills", "--restore-agents-skills",
      "--dry-run",
    ]) {
      assert.match(result.stdout, new RegExp(legacyOption), helpAlias);
    }
    for (const command of [
      "search", "describe", "invoke", "invoke-async", "invoke-status", "get-result",
    ]) {
      assert.match(result.stdout, new RegExp(`goldeneye-mcp-proxy ${command}(?: |\\n)`), helpAlias);
    }
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
