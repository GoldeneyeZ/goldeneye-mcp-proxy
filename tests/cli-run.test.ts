import test from "node:test";
import assert from "node:assert/strict";
import { runCli, type RunCliDeps } from "../src/cli/run-cli.js";
import { CliError } from "../src/cli/types.js";

type GatewayCall = [string, Record<string, unknown>, string];

function fakeCliDeps(
  call: RunCliDeps["call"],
  ensureDaemon: RunCliDeps["ensureDaemon"] = async () => true,
  overrides: Partial<RunCliDeps> = {},
): RunCliDeps {
  return {
    call,
    ensureDaemon,
    readStdin: async () => "{}",
    stdout: () => {},
    stderr: () => {},
    env: {},
    ...overrides,
  };
}

test("maps all six commands to exact gateway names and arguments", async () => {
  const calls: GatewayCall[] = [];
  const deps = fakeCliDeps(async (name, args, url) => {
    calls.push([name, args, url]);
    return { ok: true };
  });

  await runCli(["search", "db", "--server", "ctx", "--limit", "2"], deps);
  await runCli(["describe", "srv::tool"], deps);
  await runCli(["invoke", "srv::tool", "--args", "{\"x\":1}", "--timeout", "1200"], deps);
  await runCli(["invoke-async", "srv::tool", "--args", "{}"], deps);
  await runCli(["invoke-status", "job-1"], deps);
  await runCli([
    "get-result", "ref-1", "--offset", "0", "--limit", "3",
    "--fields", "id,name", "--search", "needle",
  ], deps);

  assert.deepEqual(calls.map(([name, args]) => [name, args]), [
    ["gateway.search", { query: "db", server: "ctx", limit: 2 }],
    ["gateway.describe", { id: "srv::tool" }],
    ["gateway.invoke", { id: "srv::tool", args: { x: 1 }, timeoutMs: 1200 }],
    ["gateway.invoke_async", { id: "srv::tool", args: {} }],
    ["gateway.invoke_status", { jobId: "job-1" }],
    ["gateway.get_result", {
      ref: "ref-1", offset: 0, limit: 3, fields: ["id", "name"], search: "needle",
    }],
  ]);
});

test("resolves URL by flag then environment then localhost default", async () => {
  const urls: string[] = [];
  const call = async (_name: string, _args: Record<string, unknown>, url: string) => {
    urls.push(url);
    return {};
  };

  await runCli(["search", "db", "--url", "http://flag.test/mcp"], fakeCliDeps(call, undefined, {
    env: { MCP_GATEWAY_URL: "http://env.test/mcp" },
  }));
  await runCli(["search", "db"], fakeCliDeps(call, undefined, {
    env: { MCP_GATEWAY_URL: "http://env.test/mcp" },
  }));
  await runCli(["search", "db"], fakeCliDeps(call));

  assert.deepEqual(urls, [
    "http://flag.test/mcp",
    "http://env.test/mcp",
    "http://127.0.0.1:8767/mcp",
  ]);
});

test("reads --args - from stdin", async () => {
  const calls: GatewayCall[] = [];
  const deps = fakeCliDeps(async (name, args, url) => { calls.push([name, args, url]); return {}; }, undefined, {
    readStdin: async () => '{"secret":"value"}',
  });

  assert.equal(await runCli(["invoke", "srv::tool", "--args", "-"], deps), 0);
  assert.deepEqual(calls[0][1], { id: "srv::tool", args: { secret: "value" } });
});

test("starts and retries exactly once only after daemon-unavailable", async () => {
  let attempts = 0;
  let starts = 0;
  const deps = fakeCliDeps(async () => {
    attempts += 1;
    if (attempts <= 2) throw new CliError("DAEMON_UNAVAILABLE", "unavailable", 3);
    return {};
  }, async () => { starts += 1; return true; });

  assert.equal(await runCli(["search", "db"], deps), 3);
  assert.equal(attempts, 2);
  assert.equal(starts, 1);
});

test("does not retry or start after gateway and validation failures", async () => {
  let attempts = 0;
  let starts = 0;
  const stderr: string[] = [];
  const deps = fakeCliDeps(async () => {
    attempts += 1;
    throw new CliError("GATEWAY_ERROR", "Gateway request failed", 4);
  }, async () => { starts += 1; return true; }, { stderr: value => stderr.push(value) });

  assert.equal(await runCli(["search", "db"], deps), 4);
  assert.equal(await runCli(["search"], deps), 2);
  assert.equal(attempts, 1);
  assert.equal(starts, 0);
  assert.deepEqual(stderr, [
    '{"error":{"code":"GATEWAY_ERROR","message":"Gateway request failed"}}\n',
    '{"error":{"code":"INVALID_ARGS","message":"Missing positional argument for search"}}\n',
  ]);
});

test("returns daemon-unavailable without retry when startup times out", async () => {
  let attempts = 0;
  let starts = 0;
  const deps = fakeCliDeps(async () => {
    attempts += 1;
    throw new CliError("DAEMON_UNAVAILABLE", "Gateway daemon is unavailable", 3);
  }, async () => { starts += 1; return false; });

  assert.equal(await runCli(["search", "db"], deps), 3);
  assert.equal(attempts, 1);
  assert.equal(starts, 1);
});

test("writes one compact success line to stdout and failures only to stderr", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const successDeps = fakeCliDeps(async () => ({ found: 1 }), undefined, {
    stdout: value => stdout.push(value), stderr: value => stderr.push(value),
  });
  assert.equal(await runCli(["search", "db"], successDeps), 0);
  assert.deepEqual(stdout, ['{"found":1}\n']);
  assert.equal(stderr.length, 0);

  const failureDeps = fakeCliDeps(async () => { throw new Error("boom"); }, undefined, {
    stdout: value => stdout.push(value), stderr: value => stderr.push(value),
  });
  assert.equal(await runCli(["search", "db"], failureDeps), 5);
  assert.deepEqual(stdout, ['{"found":1}\n']);
  assert.deepEqual(stderr, ['{"error":{"code":"INTERNAL_ERROR","message":"Unexpected CLI error"}}\n']);
});
