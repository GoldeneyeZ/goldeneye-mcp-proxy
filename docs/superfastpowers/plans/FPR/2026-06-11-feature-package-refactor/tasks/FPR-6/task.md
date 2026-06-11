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
