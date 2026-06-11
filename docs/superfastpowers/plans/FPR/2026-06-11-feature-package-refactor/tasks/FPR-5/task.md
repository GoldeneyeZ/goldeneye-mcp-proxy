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
