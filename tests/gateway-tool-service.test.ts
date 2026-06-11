import test from "node:test";
import assert from "node:assert/strict";
import { GatewayToolService } from "../src/tools/GatewayToolService.js";

function createService() {
  const tool = {
    id: "demo::echo",
    server: "demo",
    name: "echo",
    title: "Echo",
    description: "Echo a message",
    inputSchema: { type: "object", properties: { message: { type: "string" } } },
    outputSchema: undefined,
    fieldNames: ["message"],
  };

  const searchEngine = {
    search: () => [{ ...tool, score: 1.2345, displayName: "demo.echo" }],
    getSchema: (id: string) => (id === tool.id ? tool : undefined),
    getTool: (id: string) => (id === tool.id ? tool : undefined),
  };

  const connections = {
    getConnectedServers: () => ["demo"],
    getConnectionState: () => "connected",
    getClient: () => ({ callTool: async () => ({ content: [{ type: "text", text: "ok" }] }) }),
    ensureConnected: async () => ({ callTool: async () => ({ content: [{ type: "text", text: "ok" }] }) }),
    markServerUsed: () => undefined,
  };

  const jobManager = {
    createJob: (toolId: string, args: unknown, priority: number) => ({
      id: "job-1",
      status: "queued",
      toolId,
      args,
      priority,
      createdAt: 1,
      logs: [],
    }),
    processQueue: () => undefined,
    getJob: (id: string) => (id === "job-1"
      ? { id, status: "completed", toolId: "demo::echo", createdAt: 1, result: { ok: true }, logs: [] }
      : undefined),
  };

  const responseStore = {
    query: () => ({ data: ["a"], meta: { ref: "r1", total: 1, offset: 0, count: 1, hasMore: false } }),
  };

  const responseShield = {
    shield: (_toolId: string, raw: unknown) => ({ shielded: raw, ref: null, wasTruncated: false }),
  };

  return new GatewayToolService({
    searchEngine: searchEngine as never,
    connections: connections as never,
    jobManager: jobManager as never,
    responseStore: responseStore as never,
    responseShield: responseShield as never,
  });
}

test("search returns transport-neutral search data", () => {
  const service = createService();
  const result = service.search({ query: "echo", limit: 10 });

  assert.equal(result.found, 1);
  assert.deepEqual(result.connectedServers, ["demo"]);
  assert.equal(result.results[0].id, "demo::echo");
  assert.equal(result.results[0].connected, true);
  assert.equal(result.results[0].score, 1.23);
});

test("describe returns full schema data", () => {
  const service = createService();
  const result = service.describe({ id: "demo::echo" });

  assert.equal(result.id, "demo::echo");
  assert.deepEqual(result.inputSchema, { type: "object", properties: { message: { type: "string" } } });
});

test("describe throws for missing tool", () => {
  const service = createService();
  assert.throws(() => service.describe({ id: "demo::missing" }), /Tool not found: demo::missing/);
});

test("invoke rejects invalid composite tool IDs", async () => {
  const service = createService();
  await assert.rejects(() => service.invoke({ id: "bad", args: {} }), /Invalid tool ID format: bad/);
});
