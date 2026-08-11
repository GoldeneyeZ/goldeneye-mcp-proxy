# Agent Gateway CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superfastpowers:goal-driven-development with `goal-driven-bypass` (recommended), `goal-driven-gated`, superfastpowers:subagent-driven-development, or superfastpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daemon-backed, compact JSON CLI for all gateway operations and ship an agent skill teaching token-efficient use.

**Architecture:** Recognized subcommands dispatch from the existing executable into focused `src/cli/` modules. A JSON-RPC client calls the existing daemon, starts it only after connection failures, unwraps MCP envelopes, and emits stable compact JSON. Existing stdio, daemon, discovery, and migration modes remain unchanged.
**Plan Acronym:** AGCLI

**Tech Stack:** TypeScript ESM, Node.js 18 built-ins, MCP JSON-RPC 2.0, `node:test`, npm packaging

---

## File Structure

- `src/cli/types.ts`: CLI command unions, injected runtime dependencies, typed failures.
- `src/cli/parse-cli.ts`: recognized-command detection and option parsing.
- `src/cli/json-input.ts`: inline/stdin JSON-object input.
- `src/cli/gateway-client.ts`: HTTP JSON-RPC call and MCP content unwrapping.
- `src/cli/daemon-startup.ts`: health probe, systemd start, detached fallback, bounded polling.
- `src/cli/output.ts`: compact stdout/stderr envelopes and exit codes.
- `src/cli/run-cli.ts`: command mapping, retry orchestration, dependency injection.
- `src/index.ts`: legacy/new mode dispatch only.
- `tests/cli-*.test.ts`: focused unit/integration coverage.
- `tests/helpers/cli-http-server.ts`: disposable JSON HTTP server used by client and entrypoint tests.
- `skills/using-goldeneye-cli/`: bundled agent skill and UI metadata.
- `README.md`, `AGENT-CONTEXT.md`, `package.json`: user/agent docs and package inclusion.

### Task 1: Parse Commands and Stabilize Output

<TASK-ID>AGCLI-1</TASK-ID>

**Files:**
- Create: `src/cli/types.ts`
- Create: `src/cli/parse-cli.ts`
- Create: `src/cli/output.ts`
- Test: `tests/cli-parse.test.ts`
- Test: `tests/cli-output.test.ts`

- [ ] **Step 1: Write failing parser tests**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { isGatewayCliCommand, parseCli } from "../src/cli/parse-cli.js";

test("recognizes only six gateway CLI subcommands", () => {
  for (const name of ["search", "describe", "invoke", "invoke-async", "invoke-status", "get-result"]) {
    assert.equal(isGatewayCliCommand(name), true);
  }
  assert.equal(isGatewayCliCommand("--daemon"), false);
});

test("maps search options", () => {
  assert.deepEqual(parseCli(["search", "database tools", "--server", "context-mode", "--limit", "3"]), {
    kind: "search", query: "database tools", server: "context-mode", limit: 3,
  });
});

test("maps invoke stdin and timeout", () => {
  assert.deepEqual(parseCli(["invoke", "srv::tool", "--args", "-", "--timeout", "1200"]), {
    kind: "invoke", id: "srv::tool", argsSource: "-", timeoutMs: 1200,
  });
});

test("rejects missing values, unknown flags, duplicate flags, and invalid integers", () => {
  for (const argv of [
    ["describe"], ["search", "x", "--wat"], ["search", "x", "--limit", "0"],
    ["search", "x", "--limit", "2", "--limit", "3"],
  ]) assert.throws(() => parseCli(argv), { name: "CliError" });
});
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `node --loader ts-node/esm --test tests/cli-parse.test.ts`

Expected: FAIL because `src/cli/parse-cli.ts` does not exist.

- [ ] **Step 3: Implement command types and parser**

Define a discriminated `CliCommand` union containing exact command fields from the design. Implement `isGatewayCliCommand(value)` with a constant six-name set. Implement `parseCli(argv)` using a cursor, one positional contract per command, a shared `--url`, duplicate-option tracking, strict positive/non-negative integer parsing, comma-separated `--fields`, and `CliError("INVALID_ARGS", message, 2)`. Reject trailing positionals and unknown flags.

```typescript
export class CliError extends Error {
  constructor(public readonly code: string, message: string, public readonly exitCode: number) {
    super(message);
    this.name = "CliError";
  }
}

export type CliCommand =
  | { kind: "search"; query: string; server?: string; limit?: number; url?: string }
  | { kind: "describe"; id: string; url?: string }
  | { kind: "invoke"; id: string; argsSource: string; timeoutMs?: number; url?: string }
  | { kind: "invoke-async"; id: string; argsSource: string; url?: string }
  | { kind: "invoke-status"; jobId: string; url?: string }
  | { kind: "get-result"; ref: string; offset?: number; limit?: number; fields?: string[]; search?: string; url?: string };
```

- [ ] **Step 4: Write failing output tests**

```typescript
test("writes one compact JSON line to stdout", () => {
  const writes: string[] = [];
  writeSuccess({ found: 1 }, value => writes.push(value));
  assert.deepEqual(writes, ['{"found":1}\n']);
});

test("writes stable error envelope without supplied args", () => {
  const writes: string[] = [];
  writeFailure(new CliError("INVALID_ARGS", "bad input", 2), value => writes.push(value));
  assert.deepEqual(writes, ['{"error":{"code":"INVALID_ARGS","message":"bad input"}}\n']);
});
```

- [ ] **Step 5: Run output tests, implement minimal writer, then run both test files**

Run before implementation: `node --loader ts-node/esm --test tests/cli-output.test.ts`

Expected: FAIL because `src/cli/output.ts` does not exist.

Implement `writeSuccess`, `writeFailure`, and `toCliError` with injected write functions. Then run:

`node --loader ts-node/esm --test tests/cli-parse.test.ts tests/cli-output.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/cli/types.ts src/cli/parse-cli.ts src/cli/output.ts tests/cli-parse.test.ts tests/cli-output.test.ts
git commit -m "feat(cli): parse gateway commands and emit JSON"
```

### Task 2: Parse JSON and Call Gateway JSON-RPC

<TASK-ID>AGCLI-2</TASK-ID>

**Files:**
- Create: `src/cli/json-input.ts`
- Create: `src/cli/gateway-client.ts`
- Create: `tests/helpers/cli-http-server.ts`
- Test: `tests/cli-json-input.test.ts`
- Test: `tests/cli-gateway-client.test.ts`

- [ ] **Step 1: Write failing JSON-input tests**

```typescript
test("parses inline object", async () => {
  assert.deepEqual(await readArgs('{"x":1}', async () => ""), { x: 1 });
});

test("reads object from stdin", async () => {
  assert.deepEqual(await readArgs("-", async () => '{"secret":"value"}'), { secret: "value" });
});

test("rejects arrays and does not echo secret JSON", async () => {
  await assert.rejects(readArgs('["secret-value"]', async () => ""), error => {
    assert.equal((error as CliError).code, "INVALID_ARGS");
    assert.doesNotMatch((error as Error).message, /secret-value/);
    return true;
  });
});
```

- [ ] **Step 2: Verify RED, implement `readArgs`, verify GREEN**

Run: `node --loader ts-node/esm --test tests/cli-json-input.test.ts`

Expected RED: missing module. Implement JSON parsing, plain-object validation, and generic secret-safe messages. Re-run; expected PASS.

- [ ] **Step 3: Write failing JSON-RPC client tests against a local HTTP server**

Create this shared test helper first:

```typescript
import http from "node:http";

export async function createJsonServer(handler: (body: any) => unknown) {
  let lastBody: any;
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      lastBody = JSON.parse(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(handler(lastBody)));
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP address");
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    get lastBody() { return lastBody; },
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}
```

```typescript
test("posts tools/call and unwraps gateway JSON", async () => {
  const server = await createJsonServer(body => ({
    jsonrpc: "2.0", id: body.id,
    result: { content: [{ type: "text", text: '{"found":1,"results":[]}' }] },
  }));
  const client = new GatewayClient(server.url);
  assert.deepEqual(await client.call("gateway.search", { query: "db" }), { found: 1, results: [] });
  assert.deepEqual(server.lastBody.params, {
    name: "gateway.search", arguments: { query: "db" },
  });
});

test("classifies connection and remote failures", async () => {
  await assert.rejects(new GatewayClient("http://127.0.0.1:1/mcp").call("gateway.search", { query: "x" }),
    { code: "DAEMON_UNAVAILABLE" });
  const server = await createJsonServer(() => ({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "bad" } }));
  await assert.rejects(new GatewayClient(server.url).call("gateway.search", { query: "x" }),
    { code: "GATEWAY_ERROR" });
});
```

- [ ] **Step 4: Verify RED, implement client, verify GREEN**

Run: `node --loader ts-node/esm --test tests/cli-gateway-client.test.ts`

Expected RED: missing module. Implement request IDs, JSON headers, `fetch`, JSON-RPC validation, exactly one text content item, parsed JSON return, and typed error classification. Re-run both Task 2 files; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/json-input.ts src/cli/gateway-client.ts tests/cli-json-input.test.ts tests/cli-gateway-client.test.ts
git add tests/helpers/cli-http-server.ts
git commit -m "feat(cli): call gateway over JSON-RPC"
```

### Task 3: Recover Daemon and Run Commands

<TASK-ID>AGCLI-3</TASK-ID>

**Files:**
- Create: `src/cli/daemon-startup.ts`
- Create: `src/cli/run-cli.ts`
- Test: `tests/cli-daemon-startup.test.ts`
- Test: `tests/cli-run.test.ts`

- [ ] **Step 1: Write failing daemon recovery tests**

```typescript
test("tries systemd before detached fallback and stops when healthy", async () => {
  const calls: string[] = [];
  const result = await ensureDaemon("http://127.0.0.1:8767/mcp", {
    health: async () => calls.filter(x => x === "sleep").length > 0,
    startSystemd: async () => { calls.push("systemd"); return true; },
    startDetached: () => calls.push("detached"),
    sleep: async () => { calls.push("sleep"); },
    now: (() => { let n = 0; return () => n += 100; })(),
  }, 5000);
  assert.equal(result, true);
  assert.deepEqual(calls, ["systemd", "sleep"]);
});

test("uses one detached fallback and respects deadline", async () => {
  let detached = 0;
  const result = await ensureDaemon("http://127.0.0.1:8767/mcp", {
    health: async () => false, startSystemd: async () => false,
    startDetached: () => { detached++; }, sleep: async () => {},
    now: (() => { let n = 0; return () => n += 3000; })(),
  }, 5000);
  assert.equal(result, false);
  assert.equal(detached, 1);
});
```

- [ ] **Step 2: Verify RED, implement recovery, verify GREEN**

Run: `node --loader ts-node/esm --test tests/cli-daemon-startup.test.ts`

Expected RED: missing module. Implement `/mcp` to `/health` URL derivation, systemd child process, detached current-entrypoint spawn, 100ms polling, and five-second deadline through injected dependencies. Re-run; expected PASS.

- [ ] **Step 3: Write failing runner tests for every gateway mapping and retry boundary**

```typescript
test("maps all six commands to exact gateway names", async () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const deps = fakeCliDeps(async (name, args) => { calls.push([name, args]); return { ok: true }; });
  await runCli(["search", "db", "--limit", "2"], deps);
  await runCli(["describe", "srv::tool"], deps);
  await runCli(["invoke", "srv::tool", "--args", "{}"], deps);
  await runCli(["invoke-async", "srv::tool", "--args", "{}"], deps);
  await runCli(["invoke-status", "job-1"], deps);
  await runCli(["get-result", "ref-1", "--fields", "id,name"], deps);
  assert.deepEqual(calls.map(([name]) => name), [
    "gateway.search", "gateway.describe", "gateway.invoke", "gateway.invoke_async",
    "gateway.invoke_status", "gateway.get_result",
  ]);
});

test("starts and retries once only for daemon-unavailable error", async () => {
  let attempts = 0;
  let starts = 0;
  const deps = fakeCliDeps(async () => {
    if (++attempts === 1) throw new CliError("DAEMON_UNAVAILABLE", "unavailable", 3);
    return { ok: true };
  }, async () => { starts++; return true; });
  assert.equal(await runCli(["search", "db"], deps), 0);
  assert.equal(attempts, 2);
  assert.equal(starts, 1);
});
```

Define the local dependency builder used above:

```typescript
function fakeCliDeps(
  call: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  ensureDaemon = async () => true,
) {
  return {
    call, ensureDaemon, readStdin: async () => "{}",
    stdout: (_value: string) => {}, stderr: (_value: string) => {},
    env: {},
  };
}
```

- [ ] **Step 4: Verify RED, implement runner, verify GREEN**

Run: `node --loader ts-node/esm --test tests/cli-run.test.ts`

Expected RED: missing module. Implement URL resolution, command-to-tool arguments, stdin reads, success output, typed errors, startup/retry once, and no retry for gateway errors. Re-run Task 3 files; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/daemon-startup.ts src/cli/run-cli.ts tests/cli-daemon-startup.test.ts tests/cli-run.test.ts
git commit -m "feat(cli): recover daemon and run gateway commands"
```

### Task 4: Integrate Executable and Preserve Legacy Modes

<TASK-ID>AGCLI-4</TASK-ID>

**Files:**
- Modify: `src/index.ts`
- Test: `tests/cli-entrypoint.test.ts`
- Use: `tests/helpers/cli-http-server.ts`

- [ ] **Step 1: Write failing built-entrypoint integration tests**

```typescript
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import { createJsonServer } from "./helpers/cli-http-server.js";

const execFile = promisify(execFileCallback);

test("built binary search emits only compact gateway JSON", async () => {
  const daemon = await createJsonServer(body => ({
    jsonrpc: "2.0", id: body.id,
    result: { content: [{ type: "text", text: '{"found":1,"results":[]}' }] },
  }));
  const result = await execFile(process.execPath, ["dist/index.js", "search", "db", "--url", daemon.url]);
  assert.equal(result.stdout, '{"found":1,"results":[]}\n');
  assert.equal(result.stderr, "");
});

test("legacy help still lists daemon and discovery modes plus CLI commands", async () => {
  const result = await execFile(process.execPath, ["dist/index.js", "--help"]);
  assert.match(result.stdout, /--daemon/);
  assert.match(result.stdout, /--discover/);
  assert.match(result.stdout, /invoke-async/);
});
```

- [ ] **Step 2: Build and verify RED**

Run: `npm run build && node --test tests/cli-entrypoint.test.ts`

Expected: search test fails because entrypoint currently starts stdio mode or treats arguments as config.

- [ ] **Step 3: Add top-level CLI dispatch and usage**

Import `isGatewayCliCommand` and `runCli`. Before legacy argument parsing, detect `args[0]`; call `runCli(args).then(code => { process.exitCode = code; })`. Move legacy dispatch into an `else` branch or `runLegacy(args)` so importing does not double-run. Extend usage with exact six command forms and `MCP_GATEWAY_URL` default. Do not alter legacy branch semantics.

- [ ] **Step 4: Build, run entrypoint tests, then full existing suite**

Run: `npm run build && node --test tests/cli-entrypoint.test.ts && npm test`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/cli-entrypoint.test.ts
git commit -m "feat(cli): integrate gateway subcommands"
```

### Task 5: Bundle Agent Skill and Documentation

<TASK-ID>AGCLI-5</TASK-ID>

**Files:**
- Create: `skills/using-goldeneye-cli/SKILL.md`
- Create: `skills/using-goldeneye-cli/agents/openai.yaml`
- Modify: `README.md`
- Modify: `AGENT-CONTEXT.md`
- Modify: `package.json`
- Test: `tests/cli-package.test.ts`

- [ ] **Step 1: RED-test skill behavior without the skill**

Run at least one fresh-agent baseline scenario without exposing the future skill: ask the agent to find a database tool, infer arguments, invoke it, and recover a truncated result using only CLI availability. Record whether it skips `describe`, invents arguments, leaks secret inline, or ignores `_ref` pagination. The baseline must demonstrate at least one gap before authoring `SKILL.md`.

- [ ] **Step 2: Write failing package test**

```typescript
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const execFile = promisify(execFileCallback);

async function npmPackFileList(): Promise<string[]> {
  const { stdout } = await execFile("npm", ["pack", "--dry-run", "--json"]);
  const report = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
  return report[0].files.map(file => file.path);
}

test("npm package includes CLI skill", async () => {
  const files = await npmPackFileList();
  assert.ok(files.includes("skills/using-goldeneye-cli/SKILL.md"));
  assert.ok(files.includes("skills/using-goldeneye-cli/agents/openai.yaml"));
});
```

Run: `node --loader ts-node/esm --test tests/cli-package.test.ts`

Expected: FAIL because skill files and package inclusion do not exist.

- [ ] **Step 3: Initialize skill with official generator**

Run:

```bash
python /home/goldeneye/.codex/skills/.system/skill-creator/scripts/init_skill.py using-goldeneye-cli --path skills --interface display_name="Using Goldeneye CLI" --interface short_description="Call MCP gateway tools with compact JSON" --interface default_prompt="Use $using-goldeneye-cli to discover and call an MCP tool through the compact CLI."
```

Expected: generated `SKILL.md` and `agents/openai.yaml`; no optional resource directories.

- [ ] **Step 4: Replace template with concise skill**

Use frontmatter:

```yaml
---
name: using-goldeneye-cli
description: Use when an agent needs to discover, inspect, invoke, poll, or paginate MCP gateway tools from a shell while minimizing schema and response tokens.
---
```

Teach mandatory `search → describe → invoke`, async polling, `_ref` slicing, stdin for secrets, compact JSON expectations, `--url`, exit codes, a quick-reference table, one end-to-end example, and common mistakes. Keep under 500 words.

- [ ] **Step 5: Forward-test with skill and validate metadata**

Run the baseline-equivalent scenario in a fresh agent with the skill path exposed. Verify it searches, describes before invoking, uses stdin for secret-bearing JSON, polls async jobs when appropriate, and requests only needed `_ref` slices. Fix instruction gaps and rerun until compliant.

Run:

```bash
python /home/goldeneye/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/using-goldeneye-cli
```

Expected: validation success.

- [ ] **Step 6: Document and package**

Add CLI command reference and compact examples to `README.md`. Replace MCP-only workflow in `AGENT-CONTEXT.md` with CLI-first guidance while retaining gateway fallback. Add `skills/` to `package.json.files`. Never document inline secret values.

- [ ] **Step 7: Verify package and full project**

Run:

```bash
node --loader ts-node/esm --test tests/cli-package.test.ts
npm run build
npm test
npm pack --dry-run
```

Expected: tests/build pass; dry-run lists both skill files and compiled CLI modules.

- [ ] **Step 8: Commit**

```bash
git add skills/using-goldeneye-cli README.md AGENT-CONTEXT.md package.json tests/cli-package.test.ts
git commit -m "docs(cli): bundle agent usage skill"
```

## Plan-Wide Verification

- [ ] Run `npm run build`; expect exit `0`.
- [ ] Run `npm test`; expect zero failed tests.
- [ ] Run skill `quick_validate.py`; expect success.
- [ ] Run `npm pack --dry-run`; verify `skills/using-goldeneye-cli/SKILL.md`, `agents/openai.yaml`, and `dist/cli/*.js` appear.
- [ ] Start a fake daemon and exercise all six built CLI commands; verify one compact JSON stdout line each.
- [ ] Exercise connection refusal; verify one auto-start attempt and exit `3` after bounded failure.
- [ ] Review `git diff` and `git status`; confirm only scoped files plus pre-existing unrelated untracked files.
