# Feature Package Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superfastpowers:subagent-driven-development (recommended), superfastpowers:goal-driven-development, or superfastpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the TypeScript MCP proxy into feature packages and split large classes/functions where doing so improves clean-code boundaries, while preserving CLI, MCP behavior, and package exports.

**Architecture:** `MCPGateway` remains the composition root. Feature packages own config, catalog snapshots, upstream connections, gateway tool use cases, transports, responses, jobs, search, projects, and shared types. Stdio and HTTP transports delegate gateway tool behavior to a shared `GatewayToolService` so tool behavior is no longer duplicated.
**Plan Acronym:** FPR


**Tech Stack:** TypeScript ESM, NodeNext module resolution, Node.js built-in test runner, `ts-node/esm`, MCP TypeScript SDK, MiniSearch, Zod.

---

## File Structure And Responsibilities

- Create `src/shared/types.ts`: shared contracts currently in `src/types.ts`.
- Create `src/config/Config.ts`: config file load/write/watch behavior currently in `src/config.ts`.
- Create `src/config/lazy-config.ts`: lazy-loading defaults and normalization currently in `src/lazy-config.ts`.
- Create `src/catalog/CatalogSnapshotManager.ts`: catalog snapshot persistence currently in `src/catalog-snapshot.ts`.
- Create `src/jobs/JobManager.ts`: async job queue currently in `src/jobs.ts`.
- Create `src/search/SearchEngine.ts`: public search facade currently in `src/search.ts`.
- Create `src/search/schema-fields.ts`: schema field extraction helpers currently inside `src/search.ts`.
- Create `src/projects/ProjectRegistry.ts`: codegraph project discovery currently in `src/projectRegistry.ts`.
- Create `src/upstreams/ConnectionManager.ts`: upstream connection facade currently in `src/connections.ts`.
- Create `src/upstreams/connection-state.ts`: connection state helpers currently in `src/connection-state.ts`.
- Create `src/upstreams/environment.ts`: `parseEnvironmentVariables` currently in `src/connections.ts`.
- Create `src/upstreams/resource-monitor.ts`: process resource checks currently in `src/resource-monitor.ts`.
- Create `src/responses/ResponseStore.ts`: response ref storage, pagination, projection, and search currently in `src/response-store.ts`.
- Create `src/responses/ResponseShield.ts`: shielding coordinator currently in `src/response-store.ts`.
- Create `src/responses/response-slicing.ts`: array/string extraction and slicing helpers currently in `ResponseStore`.
- Create `src/responses/response-truncation.ts`: pure truncation helpers currently in `ResponseShield`.
- Create `src/tools/GatewayToolService.ts`: transport-neutral implementation for `gateway.search`, `gateway.describe`, `gateway.invoke`, `gateway.invoke_async`, `gateway.invoke_status`, and `gateway.get_result`.
- Create `src/tools/gateway-tool-schemas.ts`: HTTP tool schema metadata currently in `src/http-server.ts:75-171`.
- Create `src/tools/stdio-tool-registration.ts`: MCP SDK registration currently in `src/handlers.ts:39-407` plus status registration currently in `src/handlers.ts:427-463`.
- Create `src/gateway/MCPGateway.ts`: gateway lifecycle currently in `src/gateway.ts`.
- Create `src/gateway/gateway-status.ts`: `StatusHolder` and status snapshot creation currently in `src/handlers.ts:412-420` and `src/gateway.ts:83-94`.
- Create `src/gateway/project-args.ts`: codegraph `projectPath` injection currently in `src/gateway.ts:139-147` and duplicated in tool invocation paths.
- Create `src/transports/http/HttpMcpServer.ts`: HTTP lifecycle currently in `src/http-server.ts:177-245`.
- Create `src/transports/http/json-rpc.ts`: JSON-RPC types/helpers currently in `src/http-server.ts:39-63`.
- Create `src/transports/http/request-router.ts`: MCP method routing currently in `src/http-server.ts:298-378`.
- Create `src/transports/http/cors.ts`: CORS/preflight behavior currently in `src/http-server.ts:197-207`.
- Modify `src/index.ts`: update imports to new package paths and keep exports for `MCPGateway` and `HttpMcpServer`.
- Remove root compatibility wrappers only after all imports point to feature package paths and `npm run build` passes.

## Task 1: Add Verification Harness And JSON-RPC Helper

<TASK-ID>FPR-1</TASK-ID>

**Files:**
- Modify: `package.json`
- Create: `src/transports/http/json-rpc.ts`
- Create: `tests/json-rpc.test.ts`

- [ ] **Step 1: Write the failing test and test script**

Modify `package.json` scripts to include a Node test runner command:

```json
"scripts": {
  "build": "tsc",
  "test": "node --loader ts-node/esm --test tests/**/*.test.ts",
  "prepublishOnly": "npm run build",
  "dev": "node --loader ts-node/esm src/index.ts",
  "start": "node dist/index.js"
}
```

Create `tests/json-rpc.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { jsonRpcError, jsonRpcSuccess } from "../src/transports/http/json-rpc.js";

test("jsonRpcSuccess returns a JSON-RPC success envelope", () => {
  assert.deepEqual(jsonRpcSuccess("abc", { ok: true }), {
    jsonrpc: "2.0",
    id: "abc",
    result: { ok: true },
  });
});

test("jsonRpcError returns a JSON-RPC error envelope with data", () => {
  assert.deepEqual(jsonRpcError(null, -32602, "Invalid params", { field: "name" }), {
    jsonrpc: "2.0",
    id: null,
    error: {
      code: -32602,
      message: "Invalid params",
      data: { field: "name" },
    },
  });
});

test("jsonRpcError omits data when not provided", () => {
  assert.deepEqual(jsonRpcError(7, -32700, "Parse error"), {
    jsonrpc: "2.0",
    id: 7,
    error: {
      code: -32700,
      message: "Parse error",
    },
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern=jsonRpc`

Expected: FAIL because `../src/transports/http/json-rpc.js` does not exist.

- [ ] **Step 3: Add the JSON-RPC helper**

Create `src/transports/http/json-rpc.ts`:

```ts
export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export function jsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  const error: JsonRpcResponse["error"] = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}
```

- [ ] **Step 4: Run verification**

Run: `npm test -- --test-name-pattern=jsonRpc`

Expected: PASS, 3 tests pass.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

- [ ] **Step 5: Commit**

```bash
git add package.json src/transports/http/json-rpc.ts tests/json-rpc.test.ts
git commit -m "test: add json rpc helper coverage"
```

## Task 2: Move Low-Risk Files Into Feature Packages

<TASK-ID>FPR-2</TASK-ID>

**Files:**
- Move: `src/types.ts` -> `src/shared/types.ts`
- Move: `src/config.ts` -> `src/config/Config.ts`
- Move: `src/lazy-config.ts` -> `src/config/lazy-config.ts`
- Move: `src/catalog-snapshot.ts` -> `src/catalog/CatalogSnapshotManager.ts`
- Move: `src/jobs.ts` -> `src/jobs/JobManager.ts`
- Move: `src/search.ts` -> `src/search/SearchEngine.ts`
- Move: `src/projectRegistry.ts` -> `src/projects/ProjectRegistry.ts`
- Move: `src/connection-state.ts` -> `src/upstreams/connection-state.ts`
- Move: `src/resource-monitor.ts` -> `src/upstreams/resource-monitor.ts`
- Modify: `src/index.ts`, `src/gateway.ts`, `src/http-server.ts`, `src/handlers.ts`, `src/connections.ts`, moved files' imports

- [ ] **Step 1: Run baseline checks**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with the JSON-RPC tests from FPR-1.

- [ ] **Step 2: Move files**

Run these file moves:

```bash
mkdir -p src/shared src/config src/catalog src/jobs src/search src/projects src/upstreams
git mv src/types.ts src/shared/types.ts
git mv src/config.ts src/config/Config.ts
git mv src/lazy-config.ts src/config/lazy-config.ts
git mv src/catalog-snapshot.ts src/catalog/CatalogSnapshotManager.ts
git mv src/jobs.ts src/jobs/JobManager.ts
git mv src/search.ts src/search/SearchEngine.ts
git mv src/projectRegistry.ts src/projects/ProjectRegistry.ts
git mv src/connection-state.ts src/upstreams/connection-state.ts
git mv src/resource-monitor.ts src/upstreams/resource-monitor.ts
```

- [ ] **Step 3: Update imports**

Use these import mappings:

```text
./types.js -> ./shared/types.js or ../shared/types.js
./config.js -> ./config/Config.js or ../config/Config.js
./lazy-config.js -> ./config/lazy-config.js or ../config/lazy-config.js
./catalog-snapshot.js -> ./catalog/CatalogSnapshotManager.js or ../catalog/CatalogSnapshotManager.js
./jobs.js -> ./jobs/JobManager.js or ../jobs/JobManager.js
./search.js -> ./search/SearchEngine.js or ../search/SearchEngine.js
./projectRegistry.js -> ./projects/ProjectRegistry.js or ../projects/ProjectRegistry.js
./connection-state.js -> ./upstreams/connection-state.js or ../upstreams/connection-state.js
./resource-monitor.js -> ./upstreams/resource-monitor.js or ../upstreams/resource-monitor.js
```

For files now inside feature directories, import shared types with `../shared/types.js`.

- [ ] **Step 4: Run verification**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm run build`

Expected: PASS and `dist/index.js` exists.

Run: `npm test`

Expected: PASS with all tests.

- [ ] **Step 5: Commit**

```bash
git add src package.json tests
git commit -m "refactor: move core files into feature packages"
```

## Task 3: Extract Search Schema Field Helpers

<TASK-ID>FPR-3</TASK-ID>

**Files:**
- Create: `src/search/schema-fields.ts`
- Create: `tests/schema-fields.test.ts`
- Modify: `src/search/SearchEngine.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/schema-fields.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { extractFieldNames, toCamelCase } from "../src/search/schema-fields.js";

test("toCamelCase normalizes common tool names", () => {
  assert.equal(toCamelCase("Run Cypher Query"), "runCypherQuery");
  assert.equal(toCamelCase("browser_navigate"), "browserNavigate");
  assert.equal(toCamelCase("github.create-issue"), "githubCreateIssue");
});

test("extractFieldNames reads object schema properties", () => {
  const schema = {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
  };

  assert.deepEqual(extractFieldNames(schema), ["query", "limit"]);
});

test("extractFieldNames returns an empty array for non-object schemas", () => {
  assert.deepEqual(extractFieldNames(undefined), []);
  assert.deepEqual(extractFieldNames({ type: "string" }), []);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="schema|camel"`

Expected: FAIL because `src/search/schema-fields.ts` does not exist.

- [ ] **Step 3: Create helper module**

Move the current helper logic from `src/search/SearchEngine.ts` into `src/search/schema-fields.ts`:

```ts
export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

export function extractFieldNames(schema: unknown): string[] {
  if (!schema || typeof schema !== "object") return [];
  const obj = schema as { properties?: Record<string, unknown> };
  if (!obj.properties || typeof obj.properties !== "object") return [];
  return Object.keys(obj.properties);
}
```

- [ ] **Step 4: Update `SearchEngine` imports**

In `src/search/SearchEngine.ts`, remove local `toCamelCase` and `extractFieldNames` declarations and add:

```ts
import { extractFieldNames, toCamelCase } from "./schema-fields.js";
```

- [ ] **Step 5: Run verification**

Run: `npm test -- --test-name-pattern="schema|camel"`

Expected: PASS, 3 schema helper tests pass.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

- [ ] **Step 6: Commit**

```bash
git add src/search/SearchEngine.ts src/search/schema-fields.ts tests/schema-fields.test.ts
git commit -m "refactor: extract search schema helpers"
```

## Task 4: Introduce GatewayToolService

<TASK-ID>FPR-4</TASK-ID>

**Files:**
- Create: `src/tools/GatewayToolService.ts`
- Create: `src/gateway/project-args.ts`
- Create: `tests/gateway-tool-service.test.ts`
- Move/Modify: `src/gateway.ts` -> `src/gateway/MCPGateway.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/gateway-tool-service.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="GatewayToolService|search returns|describe returns|invoke rejects"`

Expected: FAIL because `src/tools/GatewayToolService.ts` does not exist.

- [ ] **Step 3: Move gateway file so gateway helpers can live beside it**

Run:

```bash
mkdir -p src/gateway
git mv src/gateway.ts src/gateway/MCPGateway.ts
```

In `src/index.ts`, update the gateway import:

```ts
import { MCPGateway } from "./gateway/MCPGateway.js";
```

- [ ] **Step 4: Add project argument helper**

Create `src/gateway/project-args.ts`:

```ts
import type { ProjectRegistry } from "../projects/ProjectRegistry.js";

export function injectProjectPath(
  serverKey: string,
  args: Record<string, unknown>,
  projectRegistry?: ProjectRegistry,
): Record<string, unknown> {
  if (serverKey !== "codegraph") return args;
  if ("projectPath" in args) return args;
  const resolved = projectRegistry?.resolveProjectPath();
  return resolved ? { ...args, projectPath: resolved } : args;
}
```

- [ ] **Step 5: Implement `GatewayToolService`**

Create `src/tools/GatewayToolService.ts` with this public surface and move behavior from `src/handlers.ts:73-398` and `src/http-server.ts:382-602` into these methods:

```ts
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ConnectionManager } from "../upstreams/ConnectionManager.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { ProjectRegistry } from "../projects/ProjectRegistry.js";
import type { ResponseShield } from "../responses/ResponseShield.js";
import type { ResponseStore } from "../responses/ResponseStore.js";
import type { SearchEngine } from "../search/SearchEngine.js";
import type { SearchFilters } from "../shared/types.js";
import { injectProjectPath } from "../gateway/project-args.js";

export interface GatewayToolServiceDeps {
  searchEngine: SearchEngine;
  connections: ConnectionManager;
  jobManager: JobManager;
  responseStore: ResponseStore;
  responseShield: ResponseShield;
  projectRegistry?: ProjectRegistry;
}

export class GatewayToolError extends Error {
  constructor(
    message: string,
    public readonly code: number = -32602,
  ) {
    super(message);
  }
}

export class GatewayToolService {
  constructor(private readonly deps: GatewayToolServiceDeps) {}

  search(args: { query?: string; limit?: number; server?: string }) {
    const query = String(args.query || "");
    const filters: SearchFilters = {};
    if (args.server) filters.server = args.server;
    const results = this.deps.searchEngine.search(query, filters, args.limit || 10);

    return {
      query,
      found: results.length,
      connectedServers: this.deps.connections.getConnectedServers(),
      results: results.map((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        server: r.server,
        connected: this.deps.connections.getConnectionState(r.server) === "connected",
        description: r.description
          ? r.description.slice(0, 120) + (r.description.length > 120 ? "..." : "")
          : undefined,
        fieldNames: r.fieldNames,
        score: Math.round(r.score * 100) / 100,
      })),
    };
  }

  describe(args: { id: string }) {
    const tool = this.deps.searchEngine.getSchema(args.id);
    if (!tool) throw new GatewayToolError(`Tool not found: ${args.id}`);

    return {
      id: tool.id,
      server: tool.server,
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    };
  }

  async invoke(args: { id: string; args: Record<string, unknown>; timeoutMs?: number }) {
    const { serverKey, toolName } = parseToolId(args.id);
    const client = await this.getClient(serverKey);
    const tool = this.deps.searchEngine.getTool(args.id);
    if (!tool) throw new GatewayToolError(`Tool not found in catalog: ${args.id}`);

    const timeout = args.timeoutMs || 60_000;
    const finalArgs = injectProjectPath(serverKey, args.args || {}, this.deps.projectRegistry);
    const result = await Promise.race([
      client.callTool({ name: toolName, arguments: finalArgs }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`TIMEOUT: Tool ${args.id} exceeded ${timeout}ms`)), timeout),
      ),
    ]);

    return this.withTruncationMetadata(args.id, result);
  }

  invokeAsync(args: { id: string; args: Record<string, unknown>; priority?: number }) {
    const job = this.deps.jobManager.createJob(args.id, args.args || {}, args.priority || 0);
    this.deps.jobManager.processQueue();
    return { jobId: job.id, status: "queued", toolId: args.id };
  }

  invokeStatus(args: { jobId: string }) {
    const job = this.deps.jobManager.getJob(args.jobId);
    if (!job) throw new GatewayToolError(`Job not found: ${args.jobId}`);
    return {
      jobId: job.id,
      status: job.status,
      toolId: job.toolId,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      result: job.result,
      error: job.error,
      logs: job.logs,
    };
  }

  getResult(args: { ref: string; offset?: number; limit?: number; fields?: string[]; search?: string }) {
    const result = this.deps.responseStore.query(args.ref, {
      offset: args.offset,
      limit: args.limit,
      fields: args.fields,
      search: args.search,
    });
    if ("error" in result) throw new GatewayToolError(result.error);
    return { ...result.meta, data: result.data };
  }

  private async getClient(serverKey: string): Promise<Client> {
    try {
      const client = this.deps.connections.getClient(serverKey) || await this.deps.connections.ensureConnected(serverKey);
      this.deps.connections.markServerUsed(serverKey);
      return client;
    } catch (error) {
      throw new GatewayToolError(`Could not connect to server: ${serverKey}. ${(error as Error).message}`, -32000);
    }
  }

  private withTruncationMetadata(toolId: string, raw: unknown) {
    const { shielded, ref } = this.deps.responseShield.shield(toolId, raw);
    if (ref && typeof shielded === "object" && shielded !== null) {
      return {
        ...(shielded as Record<string, unknown>),
        _ref: ref,
        _truncated: true,
        _note: `Response was truncated. Use gateway.get_result with ref "${ref}" to access the full data.`,
      };
    }
    return shielded;
  }
}

function parseToolId(toolId: string): { serverKey: string; toolName: string } {
  const separatorIndex = toolId.indexOf("::");
  if (separatorIndex === -1) {
    throw new GatewayToolError(`Invalid tool ID format: ${toolId}. Expected "serverKey::toolName"`);
  }
  return {
    serverKey: toolId.slice(0, separatorIndex),
    toolName: toolId.slice(separatorIndex + 2),
  };
}
```

- [ ] **Step 6: Wire async job execution through shared helper**

In `src/gateway/MCPGateway.ts`, replace duplicated codegraph project argument injection in the `jobManager.setExecuteJob` callback with:

```ts
const finalArgs = injectProjectPath(serverKey, job.args as Record<string, unknown>, this.projectRegistry);
```

- [ ] **Step 7: Run verification**

Run: `npm test -- --test-name-pattern="GatewayToolService|search returns|describe returns|invoke rejects"`

Expected: PASS with the new service tests.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

- [ ] **Step 8: Commit**

```bash
git add src/tools/GatewayToolService.ts src/gateway/MCPGateway.ts src/gateway/project-args.ts src/index.ts tests/gateway-tool-service.test.ts src
git commit -m "refactor: add shared gateway tool service"
```

## Task 5: Delegate Stdio Tool Registration To GatewayToolService

<TASK-ID>FPR-5</TASK-ID>

**Files:**
- Create: `src/tools/stdio-tool-registration.ts`
- Create: `src/gateway/gateway-status.ts`
- Modify: `src/handlers.ts` or remove it after imports are updated
- Modify: `src/gateway.ts` or `src/gateway/MCPGateway.ts`

- [ ] **Step 1: Create status types**

Create `src/gateway/gateway-status.ts`:

```ts
export interface StatusHolder {
  getConnectedServers: () => string[];
  getToolCount: (server: string) => number;
  getTotalTools: () => number;
  getConfigPath: () => string;
  getLastReloadTimestamp: () => number;
  isPendingReload: () => boolean;
  getProjects: () => Array<{ name: string; path: string }>;
  getDefaultProject: () => string | null;
}
```

- [ ] **Step 2: Create stdio registration module**

Create `src/tools/stdio-tool-registration.ts`. Keep the current Zod schemas from `src/handlers.ts:59-372`, but make each handler call `GatewayToolService`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { StatusHolder } from "../gateway/gateway-status.js";
import { GatewayToolError, GatewayToolService } from "./GatewayToolService.js";

export function createServer(toolService: GatewayToolService, statusHolder?: StatusHolder): McpServer {
  const server = new McpServer(
    { name: "goldeneye-mcp-proxy", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "gateway.search",
    {
      title: "Search MCP Tools",
      description:
        "Search for tools across all connected MCP servers using BM25 scoring with fuzzy matching. " +
        "Returns tool IDs, names, displayNames, fieldNames, descriptions, and relevance scores — NOT full schemas. " +
        "An empty query returns all available tools.",
      inputSchema: {
        query: z.string().describe("Search query (natural language, e.g. 'run cypher query' or 'navigate browser')"),
        limit: z.number().optional().describe("Max results to return (default 10, max 50)"),
        server: z.string().optional().describe("Filter results to a specific server (e.g. 'neo4j-cypher')"),
      },
    },
    async ({ query, limit, server }) => toTextResult(toolService.search({ query, limit, server })),
  );

  server.registerTool(
    "gateway.describe",
    {
      title: "Describe MCP Tool",
      description:
        "Get full details for a specific tool including its complete input schema. " +
        "Use the tool ID from gateway.search results (format: serverKey::toolName). " +
        "Most tools return fieldNames in search results — describe is only needed for full schema detail.",
      inputSchema: {
        id: z.string().describe("Tool ID from search results (e.g. 'neo4j-cypher::run_cypher_query')"),
      },
    },
    async ({ id }) => runTool(() => toolService.describe({ id })),
  );

  server.registerTool(
    "gateway.invoke",
    {
      title: "Invoke MCP Tool",
      description:
        "Execute a tool on an upstream MCP server synchronously. " +
        "Response is automatically truncated if large — check for _ref field in the result. " +
        "If _ref is present, use gateway.get_result to paginate through the full response. " +
        "Always call gateway.describe first to know the correct argument format.",
      inputSchema: {
        id: z.string().describe("Tool ID (e.g. 'playwright::browser_navigate')"),
        args: z.record(z.string(), z.unknown()).describe("Arguments to pass to the tool (match the inputSchema from gateway.describe)"),
        timeoutMs: z.number().optional().describe("Timeout in milliseconds (default 60000)"),
      },
    },
    async ({ id, args, timeoutMs }) => runTool(() => toolService.invoke({ id, args, timeoutMs })),
  );

  server.registerTool(
    "gateway.invoke_async",
    {
      title: "Invoke Tool Async",
      description:
        "Start an asynchronous tool execution. Returns a job ID immediately. " +
        "Use gateway.invoke_status to poll for completion. " +
        "Useful for long-running tools (web search, E2E tests, etc.).",
      inputSchema: {
        id: z.string().describe("Tool ID (e.g. 'tavily-remote-mcp::search')"),
        args: z.record(z.string(), z.unknown()).describe("Arguments for the tool"),
        priority: z.number().optional().describe("Priority (higher = runs first, default 0)"),
      },
    },
    async ({ id, args, priority }) => runTool(() => toolService.invokeAsync({ id, args, priority })),
  );

  server.registerTool(
    "gateway.invoke_status",
    {
      title: "Check Job Status",
      description: "Check the status of an async job. Returns status, result (if completed), or error (if failed).",
      inputSchema: {
        jobId: z.string().describe("Job ID from gateway.invoke_async"),
      },
    },
    async ({ jobId }) => runTool(() => toolService.invokeStatus({ jobId })),
  );

  server.registerTool(
    "gateway.get_result",
    {
      title: "Get Stored Result",
      description:
        "Retrieve the full result of a truncated tool response. " +
        "Use the _ref value from a truncated gateway.invoke response. " +
        "Supports pagination (offset/limit), field projection, and text search. " +
        "For arrays: offset and limit paginate through items. " +
        "For strings: offset is character position. " +
        "Use 'fields' to project specific keys from array items (reduces token usage). " +
        "Use 'search' to filter items containing specific text.",
      inputSchema: {
        ref: z.string().describe("Ref handle from a truncated response (e.g. 'r1', 'r3')"),
        offset: z.number().optional().describe("Start position (array index or char offset, default 0)"),
        limit: z.number().optional().describe("Number of items to return (default 50, max 50)"),
        fields: z.array(z.string()).optional().describe("Project only these fields from each array item"),
        search: z.string().optional().describe("Filter items containing this text (case-insensitive)"),
      },
    },
    async ({ ref, offset, limit, fields, search }) => runTool(() => toolService.getResult({ ref, offset, limit, fields, search })),
  );

  if (statusHolder) registerStatusTool(server, statusHolder);
  return server;
}

async function runTool(fn: () => unknown | Promise<unknown>) {
  try {
    return toTextResult(await fn());
  } catch (error) {
    const message = error instanceof GatewayToolError || error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `ERROR: ${message}` }],
      isError: true,
    };
  }
}

function toTextResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function registerStatusTool(server: McpServer, statusHolder: StatusHolder): void {
  server.registerTool(
    "gateway.status",
    {
      title: "Get Gateway Status",
      description:
        "Returns the current status of the gateway including connected servers, " +
        "tool counts, config file path, last reload timestamp, pending reload status, " +
        "and available codegraph projects. Use this to check if config reloaded after changes.",
      inputSchema: {},
    },
    async () => {
      const connectedServers = statusHolder.getConnectedServers();
      return toTextResult({
        connectedServers: connectedServers.map((name) => ({
          name,
          toolCount: statusHolder.getToolCount(name),
        })),
        totalTools: statusHolder.getTotalTools(),
        configPath: statusHolder.getConfigPath(),
        lastReloadTimestamp: statusHolder.getLastReloadTimestamp(),
        pendingReload: statusHolder.isPendingReload(),
        codegraphProjects: statusHolder.getProjects(),
        defaultProject: statusHolder.getDefaultProject(),
      });
    },
  );
}
```

- [ ] **Step 3: Wire gateway constructor**

In the gateway constructor, create one `GatewayToolService` with the gateway dependencies and pass it to `createServer(toolService, statusHolder)`.

Use this wiring:

```ts
this.toolService = new GatewayToolService({
  searchEngine: this.searchEngine,
  connections: this.connections,
  jobManager: this.jobManager,
  responseStore: this.responseStore,
  responseShield: this.responseShield,
  projectRegistry: this.projectRegistry,
});

this.server = createServer(this.toolService, statusHolder);
```

Add a private field:

```ts
private toolService: GatewayToolService;
```

- [ ] **Step 4: Remove old stdio implementation**

After imports compile, delete `src/handlers.ts` or replace it temporarily with:

```ts
export { createServer } from "./tools/stdio-tool-registration.js";
export type { StatusHolder } from "./gateway/gateway-status.js";
```

Prefer deletion once all imports point to `src/tools/stdio-tool-registration.ts` and `src/gateway/gateway-status.ts`.

- [ ] **Step 5: Run verification**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with all tests.

- [ ] **Step 6: Commit**

```bash
git add src tests package.json
git commit -m "refactor: delegate stdio tools to shared service"
```

## Task 6: Split HTTP Transport And Delegate Tool Calls

<TASK-ID>FPR-6</TASK-ID>

**Files:**
- Create: `src/tools/gateway-tool-schemas.ts`
- Create: `src/transports/http/cors.ts`
- Create: `src/transports/http/request-router.ts`
- Move/Modify: `src/http-server.ts` -> `src/transports/http/HttpMcpServer.ts`
- Modify: `src/index.ts`
- Modify: `src/gateway/MCPGateway.ts` or `src/gateway.ts`

- [ ] **Step 1: Write tool schema module**

Create `src/tools/gateway-tool-schemas.ts` by moving the HTTP schema list from `src/http-server.ts:75-171`:

```ts
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const GATEWAY_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "gateway.search",
    description:
      "Search for tools across all connected MCP servers using BM25 scoring with fuzzy matching. " +
      "Returns tool IDs, names, displayNames, fieldNames, descriptions, and relevance scores — NOT full schemas. " +
      "An empty query returns all available tools.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (natural language)" },
        limit: { type: "number", description: "Max results to return (default 10, max 50)" },
        server: { type: "string", description: "Filter results to a specific server" },
      },
    },
  },
  {
    name: "gateway.describe",
    description:
      "Get full details for a specific tool including its complete input schema. " +
      "Use the tool ID from gateway.search results (format: serverKey::toolName).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Tool ID from search results (e.g. 'neo4j-cypher::run_cypher_query')" },
      },
      required: ["id"],
    },
  },
  {
    name: "gateway.invoke",
    description:
      "Execute a tool on an upstream MCP server synchronously. " +
      "Response is automatically truncated if large — check for _ref field in the result. " +
      "If _ref is present, use gateway.get_result to paginate through the full response.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Tool ID (e.g. 'playwright::browser_navigate')" },
        args: { type: "object", description: "Arguments to pass to the tool" },
        timeoutMs: { type: "number", description: "Timeout in milliseconds (default 60000)" },
      },
      required: ["id", "args"],
    },
  },
  {
    name: "gateway.invoke_async",
    description:
      "Start an asynchronous tool execution. Returns a job ID immediately. " +
      "Use gateway.invoke_status to poll for completion.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Tool ID (e.g. 'tavily-remote-mcp::search')" },
        args: { type: "object", description: "Arguments for the tool" },
        priority: { type: "number", description: "Priority (higher = runs first, default 0)" },
      },
      required: ["id", "args"],
    },
  },
  {
    name: "gateway.invoke_status",
    description: "Check the status of an async job. Returns status, result (if completed), or error (if failed).",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID from gateway.invoke_async" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "gateway.get_result",
    description:
      "Retrieve the full result of a truncated tool response. " +
      "Use the _ref value from a truncated gateway.invoke response. " +
      "Supports pagination (offset/limit), field projection, and text search.",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Ref handle from a truncated response" },
        offset: { type: "number", description: "Start position (array index or char offset, default 0)" },
        limit: { type: "number", description: "Number of items to return (default 50, max 50)" },
        fields: { type: "array", items: { type: "string" }, description: "Project only these fields from each array item" },
        search: { type: "string", description: "Filter items containing this text (case-insensitive)" },
      },
      required: ["ref"],
    },
  },
];
```

- [ ] **Step 2: Add CORS helper**

Create `src/transports/http/cors.ts`:

```ts
import type http from "node:http";

export function applyCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleCorsPreflight(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== "OPTIONS") return false;
  applyCorsHeaders(res);
  res.writeHead(204);
  res.end();
  return true;
}
```

- [ ] **Step 3: Add request router**

Create `src/transports/http/request-router.ts`:

```ts
import { GatewayToolError, GatewayToolService } from "../../tools/GatewayToolService.js";
import { GATEWAY_TOOL_SCHEMAS } from "../../tools/gateway-tool-schemas.js";
import { jsonRpcError, jsonRpcSuccess, type JsonRpcId, type JsonRpcRequest, type JsonRpcResponse } from "./json-rpc.js";

const MCP_PROTOCOL_VERSION = "2024-11-05";

export class HttpMcpRequestRouter {
  private initialized = false;

  constructor(private readonly toolService: GatewayToolService) {}

  async route(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
    const id = request.id ?? null;
    const { method, params } = request;

    switch (method) {
      case "initialize":
        return this.handleInitialize(id);
      case "notifications/initialized":
        this.initialized = true;
        return undefined;
      case "notifications/cancelled":
        return undefined;
      case "ping":
        return jsonRpcSuccess(id, {});
      case "tools/list":
        return this.handleToolsList(id);
      case "tools/call":
        return await this.handleToolsCall(id, params as Record<string, unknown> | undefined);
      default:
        return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
  }

  private handleInitialize(id: JsonRpcId): JsonRpcResponse {
    return jsonRpcSuccess(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "goldeneye-mcp-proxy", version: "1.0.0" },
    });
  }

  private handleToolsList(id: JsonRpcId): JsonRpcResponse {
    return jsonRpcSuccess(id, {
      tools: GATEWAY_TOOL_SCHEMAS.map((tool) => ({
        name: tool.name,
        title: tool.name.replace("gateway.", ""),
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  }

  private async handleToolsCall(id: JsonRpcId, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (!params || !params.name) {
      return jsonRpcError(id, -32602, "Invalid params: 'name' is required");
    }

    const toolName = String(params.name);
    const args = (params.arguments as Record<string, unknown>) || {};

    try {
      switch (toolName) {
        case "gateway.search":
          return jsonRpcSuccess(id, toContent(this.toolService.search({
            query: String(args.query || ""),
            limit: Number(args.limit) || 10,
            server: args.server ? String(args.server) : undefined,
          })));
        case "gateway.describe":
          return jsonRpcSuccess(id, toContent(this.toolService.describe({ id: String(args.id || "") })));
        case "gateway.invoke":
          return jsonRpcSuccess(id, toContent(await this.toolService.invoke({
            id: String(args.id || ""),
            args: (args.args as Record<string, unknown>) || {},
            timeoutMs: Number(args.timeoutMs) || 60_000,
          })));
        case "gateway.invoke_async":
          return jsonRpcSuccess(id, toContent(this.toolService.invokeAsync({
            id: String(args.id || ""),
            args: (args.args as Record<string, unknown>) || {},
            priority: Number(args.priority) || 0,
          })));
        case "gateway.invoke_status":
          return jsonRpcSuccess(id, toContent(this.toolService.invokeStatus({ jobId: String(args.jobId || "") })));
        case "gateway.get_result":
          return jsonRpcSuccess(id, toContent(this.toolService.getResult({
            ref: String(args.ref || ""),
            offset: Number(args.offset) || undefined,
            limit: args.limit !== undefined ? Number(args.limit) : undefined,
            fields: args.fields as string[] | undefined,
            search: args.search ? String(args.search) : undefined,
          })));
        default:
          return jsonRpcError(id, -32602, `Unknown tool: ${toolName}. Available tools: gateway.search, gateway.describe, gateway.invoke, gateway.invoke_async, gateway.invoke_status, gateway.get_result`);
      }
    } catch (error) {
      if (error instanceof GatewayToolError) {
        return jsonRpcError(id, error.code, error.message);
      }
      return jsonRpcError(id, -32000, (error as Error).message);
    }
  }
}

function toContent(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}
```

- [ ] **Step 4: Move and simplify `HttpMcpServer`**

Move `src/http-server.ts` to `src/transports/http/HttpMcpServer.ts`. Replace inline JSON-RPC helpers, schemas, routing, and tool execution with imports:

```ts
import http from "node:http";
import type { ConnectionManager } from "../../upstreams/ConnectionManager.js";
import type { SearchEngine } from "../../search/SearchEngine.js";
import { GatewayToolService } from "../../tools/GatewayToolService.js";
import { applyCorsHeaders, handleCorsPreflight } from "./cors.js";
import { jsonRpcError, type JsonRpcRequest } from "./json-rpc.js";
import { HttpMcpRequestRouter } from "./request-router.js";
```

Constructor shape:

```ts
constructor(
  private readonly searchEngine: SearchEngine,
  private readonly connections: ConnectionManager,
  private readonly toolService: GatewayToolService,
  port?: number,
) {
  this.port = port || 8767;
  this.router = new HttpMcpRequestRouter(toolService);
}
```

Keep `handleHealth`, `start`, `shutdown`, and request body parsing. In `handleJsonRpc`, call:

```ts
const response = await this.router.route(request);
```

- [ ] **Step 5: Update gateway daemon wiring**

Where the daemon creates `HttpMcpServer`, pass `services.toolService` instead of individual tool dependencies. Keep health dependencies as `searchEngine` and `connections`.

The call should be:

```ts
const httpServer = new HttpMcpServer(
  services.searchEngine,
  services.connections,
  services.toolService,
  daemonPort,
);
```

- [ ] **Step 6: Run verification**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with all tests.

Run: `npm run build`

Expected: PASS and `dist/transports/http/HttpMcpServer.js` exists.

- [ ] **Step 7: Commit**

```bash
git add src tests package.json
git commit -m "refactor: split http transport routing"
```

## Task 7: Split Response Store And Shielding Helpers

<TASK-ID>FPR-7</TASK-ID>

**Files:**
- Move/Modify: `src/response-store.ts` -> `src/responses/ResponseStore.ts`
- Create: `src/responses/ResponseShield.ts`
- Create: `src/responses/response-slicing.ts`
- Create: `src/responses/response-truncation.ts`
- Create: `tests/response-truncation.test.ts`
- Modify: imports in gateway/tool service files

- [ ] **Step 1: Write failing truncation tests**

Create `tests/response-truncation.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { stripHeavyFields, truncateArrays, truncateStrings } from "../src/responses/response-truncation.js";

test("truncateArrays caps long arrays and appends metadata", () => {
  let truncated = false;
  const input = Array.from({ length: 55 }, (_, index) => ({ index }));
  const output = truncateArrays(input, () => { truncated = true; }) as unknown[];

  assert.equal(truncated, true);
  assert.equal(output.length, 51);
  assert.deepEqual(output[50], {
    _truncated: true,
    _total: 55,
    _showing: 50,
    _message: "[TRUNCATED: 5 more items. Use gateway.get_result to paginate]",
  });
});

test("stripHeavyFields removes large non-signal fields", () => {
  let stripped = false;
  const input = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    payload: "x".repeat(300),
  }));
  const output = stripHeavyFields(input, () => { stripped = true; }) as Array<Record<string, unknown>>;

  assert.equal(stripped, true);
  assert.equal(output[0].id, "0");
  assert.equal("payload" in output[0], false);
  assert.deepEqual(output[0]._omitted, ["payload"]);
});

test("truncateStrings caps long strings", () => {
  let truncated = false;
  const output = truncateStrings("x".repeat(8200), () => { truncated = true; }) as string;

  assert.equal(truncated, true);
  assert.equal(output.startsWith("x".repeat(8192)), true);
  assert.match(output, /\[\.\.\.TRUNCATED: 8 more chars\]/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="truncate|stripHeavyFields"`

Expected: FAIL because `src/responses/response-truncation.ts` does not exist.

- [ ] **Step 3: Move response files**

Run:

```bash
mkdir -p src/responses
git mv src/response-store.ts src/responses/ResponseStore.ts
```

Split the moved file:

- Keep `ResponseStore` in `src/responses/ResponseStore.ts`.
- Move `ResponseShield` to `src/responses/ResponseShield.ts`.
- Move `extractArray` and string slicing support to `src/responses/response-slicing.ts`.
- Move `deepClone`, `truncateArrays`, `stripHeavyFields`, `truncateStrings`, and `enforceMaxSize` to `src/responses/response-truncation.ts`.

- [ ] **Step 4: Implement truncation helper exports**

`src/responses/response-truncation.ts` should export constants and pure functions:

```ts
export const MAX_ARRAY_LENGTH = 50;
export const MAX_STRING_LENGTH = 8192;
export const MAX_RESPONSE_BYTES = 65536;
export const HEAVY_FIELD_THRESHOLD = 256;

const SIGNAL_FIELDS = new Set([
  "id", "name", "title", "type", "status", "state", "label",
  "sha", "ref", "path", "url", "html_url",
  "created_at", "updated_at", "number", "key",
  "message", "description", "summary", "error",
]);

export function deepClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export function truncateArrays(data: unknown, onTruncate: (v: boolean) => void): unknown {
  if (Array.isArray(data)) {
    if (data.length > MAX_ARRAY_LENGTH) {
      onTruncate(true);
      const kept = data.slice(0, MAX_ARRAY_LENGTH);
      return [
        ...kept,
        {
          _truncated: true,
          _total: data.length,
          _showing: MAX_ARRAY_LENGTH,
          _message: `[TRUNCATED: ${data.length - MAX_ARRAY_LENGTH} more items. Use gateway.get_result to paginate]`,
        },
      ];
    }
    return data.map((item) => truncateArrays(item, onTruncate));
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateArrays(value, onTruncate);
    }
    return result;
  }

  if (typeof data === "string" && data.length > 1000) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > MAX_ARRAY_LENGTH) {
        onTruncate(true);
        const kept = parsed.slice(0, MAX_ARRAY_LENGTH);
        kept.push({
          _truncated: true,
          _total: parsed.length,
          _showing: MAX_ARRAY_LENGTH,
          _message: `[TRUNCATED: ${parsed.length - MAX_ARRAY_LENGTH} more items. Use gateway.get_result to paginate]`,
        });
        return JSON.stringify(kept);
      }
    } catch {
      return data;
    }
  }

  return data;
}

export function stripHeavyFields(data: unknown, onStrip: (v: boolean) => void): unknown {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data) && data.length > 5) {
    const sampleSize = Math.min(data.length, 10);
    const sample = data.slice(0, sampleSize);

    if (sample.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      const fieldSizes = new Map<string, number>();
      const fieldCounts = new Map<string, number>();

      for (const item of sample) {
        const obj = item as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
          const size = JSON.stringify(value).length;
          fieldSizes.set(key, (fieldSizes.get(key) || 0) + size);
          fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
        }
      }

      const heavyFields: string[] = [];
      for (const [field, totalSize] of fieldSizes) {
        const count = fieldCounts.get(field) || 1;
        const avg = totalSize / count;
        if (avg > HEAVY_FIELD_THRESHOLD && !SIGNAL_FIELDS.has(field)) {
          heavyFields.push(field);
        }
      }

      if (heavyFields.length > 0) {
        onStrip(true);
        return data.map((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const obj = item as Record<string, unknown>;
            const stripped: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
              if (!heavyFields.includes(key)) {
                stripped[key] = value;
              }
            }
            stripped._omitted = heavyFields;
            return stripped;
          }
          return item;
        });
      }
    }
  }

  if (!Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = stripHeavyFields(value, onStrip);
    }
    return result;
  }

  return data;
}

export function truncateStrings(data: unknown, onTruncate: (v: boolean) => void): unknown {
  if (typeof data === "string") {
    if (data.length > MAX_STRING_LENGTH) {
      onTruncate(true);
      return data.slice(0, MAX_STRING_LENGTH) + `\n[...TRUNCATED: ${data.length - MAX_STRING_LENGTH} more chars]`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => truncateStrings(item, onTruncate));
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateStrings(value, onTruncate);
    }
    return result;
  }

  return data;
}

export function enforceMaxSize(data: unknown): unknown {
  let current = deepClone(data);
  let iterations = 0;
  const maxIterations = 20;

  while (JSON.stringify(current).length > MAX_RESPONSE_BYTES && iterations < maxIterations) {
    iterations++;

    if (typeof current === "object" && current !== null) {
      const obj = current as Record<string, unknown>;

      if (Array.isArray(obj.content)) {
        for (let i = 0; i < obj.content.length; i++) {
          const item = obj.content[i] as Record<string, unknown>;
          if (item && typeof item.text === "string" && item.text.length > 2000) {
            const text = item.text;
            item.text = text.slice(0, Math.floor(text.length / 2)) +
              `\n[...TRUNCATED to fit 64KB limit]`;
          }
        }
      }

      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value) && value.length > 10) {
          const halfLen = Math.floor(value.length * 0.75);
          obj[key] = [
            ...value.slice(0, halfLen),
            {
              _truncated: true,
              _dropped: value.length - halfLen,
              _message: "[Dropped items to fit 64KB response limit. Use gateway.get_result to paginate]",
            },
          ];
        }
      }
    }

    if (typeof current === "string" && current.length > MAX_RESPONSE_BYTES) {
      current = current.slice(0, MAX_RESPONSE_BYTES - 100) +
        `\n[...TRUNCATED to fit 64KB limit]`;
    }
  }

  return current;
}
```

- [ ] **Step 5: Update `ResponseShield` coordinator**

`src/responses/ResponseShield.ts` should import helpers and keep only orchestration:

```ts
import type { ShieldResult } from "../shared/types.js";
import { ResponseStore } from "./ResponseStore.js";
import { deepClone, enforceMaxSize, MAX_RESPONSE_BYTES, stripHeavyFields, truncateArrays, truncateStrings } from "./response-truncation.js";

export class ResponseShield {
  constructor(private readonly responseStore: ResponseStore) {}

  shield(toolId: string, raw: unknown): ShieldResult {
    let shielded = deepClone(raw);
    let wasTruncated = false;

    shielded = truncateArrays(shielded, (didTruncate) => {
      if (didTruncate) wasTruncated = true;
    });

    shielded = stripHeavyFields(shielded, (didStrip) => {
      if (didStrip) wasTruncated = true;
    });

    shielded = truncateStrings(shielded, (didTruncate) => {
      if (didTruncate) wasTruncated = true;
    });

    if (JSON.stringify(shielded).length > MAX_RESPONSE_BYTES) {
      shielded = enforceMaxSize(shielded);
      wasTruncated = true;
    }

    const ref = wasTruncated ? this.responseStore.store(toolId, raw) : null;
    return { shielded, ref, wasTruncated };
  }
}
```

- [ ] **Step 6: Run verification**

Run: `npm test -- --test-name-pattern="truncate|stripHeavyFields"`

Expected: PASS with truncation helper tests.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with all tests.

- [ ] **Step 7: Commit**

```bash
git add src/responses src tests
git commit -m "refactor: split response shielding helpers"
```

## Task 8: Move Gateway And Upstream Internals

<TASK-ID>FPR-8</TASK-ID>

**Files:**
- Move/Modify: `src/connections.ts` -> `src/upstreams/ConnectionManager.ts`
- Create: `src/upstreams/environment.ts`
- Modify: `src/index.ts`
- Modify: imports across `src`

- [ ] **Step 1: Move connection facade file**

Run:

```bash
git mv src/connections.ts src/upstreams/ConnectionManager.ts
```

- [ ] **Step 2: Extract environment parser**

Create `src/upstreams/environment.ts` with the existing `parseEnvironmentVariables` body from `src/connections.ts:30-44`:

```ts
export function parseEnvironmentVariables(env?: Record<string, string>): Record<string, string> | undefined {
  if (!env) return undefined;

  const parsed: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    parsed[key] = value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => process.env[varName] || "");
  }
  return parsed;
}
```

In `src/upstreams/ConnectionManager.ts`, remove the local `parseEnvironmentVariables` function and import it:

```ts
import { parseEnvironmentVariables } from "./environment.js";
```

- [ ] **Step 3: Update public imports and exports**

In `src/index.ts`, keep imports on feature package paths:

```ts
import { MCPGateway } from "./gateway/MCPGateway.js";
import { HttpMcpServer } from "./transports/http/HttpMcpServer.js";
```

Keep the public export:

```ts
export { MCPGateway, HttpMcpServer };
```

In `src/gateway/MCPGateway.ts`, update imports to feature package paths:

```ts
import { CatalogSnapshotManager } from "../catalog/CatalogSnapshotManager.js";
import { Config } from "../config/Config.js";
import { normalizeLazyConfig } from "../config/lazy-config.js";
import { JobManager } from "../jobs/JobManager.js";
import { ProjectRegistry } from "../projects/ProjectRegistry.js";
import { ResponseShield } from "../responses/ResponseShield.js";
import { ResponseStore } from "../responses/ResponseStore.js";
import { SearchEngine } from "../search/SearchEngine.js";
import type { GatewayConfig } from "../shared/types.js";
import { createServer } from "../tools/stdio-tool-registration.js";
import { GatewayToolService } from "../tools/GatewayToolService.js";
import { ConnectionManager } from "../upstreams/ConnectionManager.js";
import { ResourceMonitor } from "../upstreams/resource-monitor.js";
```

- [ ] **Step 4: Run verification**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with all tests.

Run: `npm run build`

Expected: PASS and `dist/index.js` still exists.

- [ ] **Step 5: Commit**

```bash
git add src tests package.json
git commit -m "refactor: move gateway and upstream internals"
```

## Task 9: Final Cleanup And Compatibility Check

<TASK-ID>FPR-9</TASK-ID>

**Files:**
- Modify: `src/index.ts`
- Delete: stale root files left after compatibility period
- Modify: `README.md` only if command names or documented file paths changed

- [ ] **Step 1: Find stale root files**

Run:

```bash
find src -maxdepth 1 -type f -name '*.ts' -print | sort
```

Expected remaining root file list:

```text
src/index.ts
```

If compatibility wrappers remain, remove them after updating imports that reference them.

- [ ] **Step 2: Search for old import paths**

Run:

```bash
rg -n "\"\\./(gateway|http-server|handlers|connections|response-store|search|jobs|types|config|lazy-config|catalog-snapshot|projectRegistry|resource-monitor|connection-state)\\.js\"|\"\\.\\./(gateway|http-server|handlers|connections|response-store|search|jobs|types|config|lazy-config|catalog-snapshot|projectRegistry|resource-monitor|connection-state)\\.js\"" src tests
```

Expected: no matches.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: PASS with all tests.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm run build`

Expected: PASS and `dist/index.js` exists.

Run: `node dist/index.js --help`

Expected: prints usage text and exits without starting a daemon.

- [ ] **Step 4: Check working tree and public package metadata**

Run: `git status --short`

Expected: only intended cleanup files are modified.

Run:

```bash
node -e "const p=require('./package.json'); console.log(p.bin['goldeneye-mcp-proxy'], p.exports['.'].import, p.types)"
```

Expected output:

```text
dist/index.js ./dist/index.js ./dist/index.d.ts
```

- [ ] **Step 5: Commit**

```bash
git add src tests package.json README.md
git commit -m "refactor: finalize feature package layout"
```

## Final Verification

After Task 9, run:

```bash
npm test
./node_modules/.bin/tsc --noEmit
npm run build
node dist/index.js --help
git status --short
```

Expected:

- Tests pass.
- TypeScript emits no diagnostics.
- Build succeeds.
- CLI help still works from `dist/index.js`.
- Working tree contains only unrelated pre-existing untracked files, if any.
