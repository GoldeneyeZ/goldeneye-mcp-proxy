import test from "node:test";
import assert from "node:assert/strict";
import { HttpMcpRequestRouter } from "../src/transports/http/request-router.js";

const gatewayService = {
  search: () => ({ found: 0, results: [] }),
  describe: () => ({}),
  invoke: async () => ({}),
  invokeAsync: () => ({}),
  invokeStatus: () => ({}),
  getResult: () => ({}),
};

const skillService = {
  list: () => ({ count: 1, skills: [{ id: "codex-deferred::review", name: "review" }] }),
  search: () => ({ query: "review", found: 1, results: [{ id: "codex-deferred::review" }] }),
  pull: () => ({ id: "codex-deferred::review", content: "# Review", resources: [] }),
  readResource: () => ({ path: "references/guide.md", content: "# Guide\n", size: 8 }),
  status: () => ({ skillCount: 1 }),
};

test("tools/list includes skills tools separately from gateway tools", async () => {
  const router = new HttpMcpRequestRouter(gatewayService as never, skillService as never);

  const response = await router.route({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const names = (response?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);

  assert.ok(names.includes("gateway.search"));
  assert.ok(names.includes("skills.list"));
  assert.ok(names.includes("skills.search"));
  assert.ok(names.includes("skills.pull"));
  assert.ok(names.includes("skills.read_resource"));
  assert.ok(names.includes("skills.status"));
});

test("tools/call routes skills.list", async () => {
  const router = new HttpMcpRequestRouter(gatewayService as never, skillService as never);

  const response = await router.route({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "skills.list", arguments: { limit: 5 } },
  });

  const content = (response?.result as { content: Array<{ text: string }> }).content[0].text;
  assert.match(content, /codex-deferred::review/);
});

test("tools/call routes skills.search", async () => {
  const router = new HttpMcpRequestRouter(gatewayService as never, skillService as never);

  const response = await router.route({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "skills.search", arguments: { query: "review" } },
  });

  const content = (response?.result as { content: Array<{ text: string }> }).content[0].text;
  assert.match(content, /codex-deferred::review/);
});
