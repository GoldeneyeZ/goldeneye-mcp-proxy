import test from "node:test";
import assert from "node:assert/strict";
import { isGatewayCliCommand, parseCli } from "../src/cli/parse-cli.js";

test("recognizes only six gateway CLI subcommands", () => {
  for (const name of [
    "search",
    "describe",
    "invoke",
    "invoke-async",
    "invoke-status",
    "get-result",
  ]) {
    assert.equal(isGatewayCliCommand(name), true);
  }

  for (const name of ["--daemon", "invoke_async", "", undefined]) {
    assert.equal(isGatewayCliCommand(name), false);
  }
});

test("maps search options", () => {
  assert.deepEqual(
    parseCli([
      "search",
      "database tools",
      "--server",
      "context-mode",
      "--limit",
      "3",
      "--url",
      "http://localhost:9000/mcp",
    ]),
    {
      kind: "search",
      query: "database tools",
      server: "context-mode",
      limit: 3,
      url: "http://localhost:9000/mcp",
    },
  );
});

test("maps describe options", () => {
  assert.deepEqual(parseCli(["describe", "srv::tool", "--url", "http://gateway/mcp"]), {
    kind: "describe",
    id: "srv::tool",
    url: "http://gateway/mcp",
  });
});

test("maps invoke stdin and timeout", () => {
  assert.deepEqual(parseCli(["invoke", "srv::tool", "--args", "-", "--timeout", "1200"]), {
    kind: "invoke",
    id: "srv::tool",
    argsSource: "-",
    timeoutMs: 1200,
  });
});

test("maps async invocation options", () => {
  assert.deepEqual(parseCli(["invoke-async", "srv::tool", "--args", '{"x":1}', "--url", "custom"]), {
    kind: "invoke-async",
    id: "srv::tool",
    argsSource: '{"x":1}',
    url: "custom",
  });
});

test("maps invocation status options", () => {
  assert.deepEqual(parseCli(["invoke-status", "job-1", "--url", "custom"]), {
    kind: "invoke-status",
    jobId: "job-1",
    url: "custom",
  });
});

test("maps result slicing options", () => {
  assert.deepEqual(
    parseCli([
      "get-result",
      "ref-1",
      "--offset",
      "0",
      "--limit",
      "25",
      "--fields",
      "id, name",
      "--search",
      "needle",
      "--url",
      "custom",
    ]),
    {
      kind: "get-result",
      ref: "ref-1",
      offset: 0,
      limit: 25,
      fields: ["id", "name"],
      search: "needle",
      url: "custom",
    },
  );
});

test("rejects missing commands, positionals, and required options", () => {
  for (const argv of [
    [],
    ["unknown"],
    ["describe"],
    ["invoke", "srv::tool"],
    ["invoke-async", "srv::tool"],
    ["invoke-status"],
    ["get-result"],
  ]) {
    assert.throws(() => parseCli(argv), { name: "CliError" });
  }
});

test("rejects unknown, duplicate, trailing, and valueless options", () => {
  for (const argv of [
    ["search", "x", "--wat"],
    ["search", "x", "trailing"],
    ["search", "x", "--limit"],
    ["search", "x", "--server", ""],
    ["search", "x", "--server", "--limit", "2"],
    ["search", "x", "--limit", "2", "--limit", "3"],
    ["describe", "srv::tool", "--url", "a", "--url", "b"],
    ["invoke", "srv::tool", "--args", "{}", "--args", "{}"],
  ]) {
    assert.throws(() => parseCli(argv), { name: "CliError" });
  }
});

test("rejects invalid integers and empty field lists", () => {
  for (const argv of [
    ["search", "x", "--limit", "0"],
    ["search", "x", "--limit", "2.5"],
    ["search", "x", "--limit", "2x"],
    ["invoke", "srv::tool", "--args", "{}", "--timeout", "0"],
    ["get-result", "ref", "--offset", "-1"],
    ["get-result", "ref", "--limit", "0"],
    ["get-result", "ref", "--fields", ", ,"],
  ]) {
    assert.throws(() => parseCli(argv), { name: "CliError" });
  }
});

test("invalid input uses stable usage error metadata", () => {
  assert.throws(
    () => parseCli(["search", "x", "--limit", "0"]),
    (error: unknown) => {
      assert.deepEqual(
        { name: (error as Error).name, code: (error as { code: string }).code, exitCode: (error as { exitCode: number }).exitCode },
        { name: "CliError", code: "INVALID_ARGS", exitCode: 2 },
      );
      return true;
    },
  );
});
