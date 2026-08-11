import test from "node:test";
import assert from "node:assert/strict";
import { GatewayClient } from "../src/cli/gateway-client.js";
import { CliError } from "../src/cli/types.js";
import { createJsonServer } from "./helpers/cli-http-server.js";

test("posts tools/call and unwraps gateway JSON", async (t) => {
  const server = await createJsonServer(body => ({
    jsonrpc: "2.0",
    id: (body as { id: number }).id,
    result: { content: [{ type: "text", text: '{"found":1,"results":[]}' }] },
  }));
  t.after(() => server.close());

  const client = new GatewayClient(server.url);
  assert.deepEqual(await client.call("gateway.search", { query: "db" }), { found: 1, results: [] });
  assert.deepEqual(server.lastBody, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "gateway.search", arguments: { query: "db" } },
  });
});

test("increments request IDs", async (t) => {
  const ids: number[] = [];
  const server = await createJsonServer(body => {
    const id = (body as { id: number }).id;
    ids.push(id);
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "{}" }] } };
  });
  t.after(() => server.close());
  const client = new GatewayClient(server.url);
  await client.call("gateway.search", {});
  await client.call("gateway.describe", {});
  assert.deepEqual(ids, [1, 2]);
});

test("classifies connection refusal as daemon unavailable", async () => {
  await assert.rejects(
    new GatewayClient("http://127.0.0.1:1/mcp").call("gateway.search", { query: "x" }),
    (error: unknown) => assertCliError(error, "DAEMON_UNAVAILABLE", 3),
  );
});

test("classifies JSON-RPC errors as gateway failures", async (t) => {
  const server = await createJsonServer(body => ({
    jsonrpc: "2.0", id: (body as { id: number }).id,
    error: { code: -32602, message: "bad request" },
  }));
  t.after(() => server.close());
  await assert.rejects(
    new GatewayClient(server.url).call("gateway.search", { query: "x" }),
    (error: unknown) => assertCliError(error, "GATEWAY_ERROR", 4),
  );
});

for (const [name, response] of [
  ["wrong JSON-RPC version", { jsonrpc: "1.0", id: 1, result: {} }],
  ["mismatched ID", { jsonrpc: "2.0", id: 99, result: {} }],
  ["missing content", { jsonrpc: "2.0", id: 1, result: {} }],
  ["multiple content items", { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "{}" }, { type: "text", text: "{}" }] } }],
  ["non-text content", { jsonrpc: "2.0", id: 1, result: { content: [{ type: "image", data: "x" }] } }],
  ["invalid content JSON", { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "not-json" }] } }],
] as const) {
  test(`classifies ${name} as an internal failure`, async (t) => {
    const server = await createJsonServer(() => response);
    t.after(() => server.close());
    await assert.rejects(
      new GatewayClient(server.url).call("gateway.search", {}),
      (error: unknown) => assertCliError(error, "INTERNAL_ERROR", 5),
    );
  });
}

function assertCliError(error: unknown, code: string, exitCode: number): boolean {
  assert.ok(error instanceof CliError);
  assert.equal(error.code, code);
  assert.equal(error.exitCode, exitCode);
  return true;
}
