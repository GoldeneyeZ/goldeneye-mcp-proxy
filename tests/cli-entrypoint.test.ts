import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
// @ts-expect-error Native Node TypeScript execution requires the source extension.
import { createJsonServer } from "./helpers/cli-http-server.ts";

const entrypoint = fileURLToPath(new URL("../dist/index.js", import.meta.url));

interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runEntrypoint(args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [entrypoint, ...args], { encoding: "utf8", timeout: 2_000 }, (error, stdout, stderr) => {
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
