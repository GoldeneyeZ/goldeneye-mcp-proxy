## Task 4: Introduce GatewayToolService

<TASK-ID>FPR-4</TASK-ID>

**Files:**
- Create: `src/tools/GatewayToolService.ts`
- Create: `src/gateway/project-args.ts`
- Create: `tests/gateway-tool-service.test.ts`
- Modify: `src/gateway/MCPGateway.ts` or `src/gateway.ts` if Task 6 has not moved it yet

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

- [ ] **Step 3: Add project argument helper**

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

- [ ] **Step 4: Implement `GatewayToolService`**

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

- [ ] **Step 5: Wire async job execution through shared helper**

In the gateway constructor, replace duplicated codegraph project argument injection in the `jobManager.setExecuteJob` callback with:

```ts
const finalArgs = injectProjectPath(serverKey, job.args as Record<string, unknown>, this.projectRegistry);
```

- [ ] **Step 6: Run verification**

Run: `npm test -- --test-name-pattern="GatewayToolService|search returns|describe returns|invoke rejects"`

Expected: PASS with the new service tests.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

- [ ] **Step 7: Commit**

```bash
git add src/tools/GatewayToolService.ts src/gateway/project-args.ts tests/gateway-tool-service.test.ts src
git commit -m "refactor: add shared gateway tool service"
```
