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
