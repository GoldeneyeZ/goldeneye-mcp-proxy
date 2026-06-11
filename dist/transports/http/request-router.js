import { GatewayToolError } from "../../tools/GatewayToolService.js";
import { GATEWAY_TOOL_SCHEMAS } from "../../tools/gateway-tool-schemas.js";
import { jsonRpcError, jsonRpcSuccess } from "./json-rpc.js";
const MCP_PROTOCOL_VERSION = "2024-11-05";
export class HttpMcpRequestRouter {
    toolService;
    initialized = false;
    constructor(toolService) {
        this.toolService = toolService;
    }
    async route(request) {
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
                return await this.handleToolsCall(id, params);
            default:
                return jsonRpcError(id, -32601, `Method not found: ${method}`);
        }
    }
    handleInitialize(id) {
        return jsonRpcSuccess(id, {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "goldeneye-mcp-proxy", version: "1.0.0" },
        });
    }
    handleToolsList(id) {
        return jsonRpcSuccess(id, {
            tools: GATEWAY_TOOL_SCHEMAS.map((tool) => ({
                name: tool.name,
                title: tool.name.replace("gateway.", ""),
                description: tool.description,
                inputSchema: tool.inputSchema,
            })),
        });
    }
    async handleToolsCall(id, params) {
        if (!params || !params.name) {
            return jsonRpcError(id, -32602, "Invalid params: 'name' is required");
        }
        const toolName = String(params.name);
        const args = params.arguments || {};
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
                        args: args.args || {},
                        timeoutMs: Number(args.timeoutMs) || 60_000,
                    })));
                case "gateway.invoke_async":
                    return jsonRpcSuccess(id, toContent(this.toolService.invokeAsync({
                        id: String(args.id || ""),
                        args: args.args || {},
                        priority: Number(args.priority) || 0,
                    })));
                case "gateway.invoke_status":
                    return jsonRpcSuccess(id, toContent(this.toolService.invokeStatus({ jobId: String(args.jobId || "") })));
                case "gateway.get_result":
                    return jsonRpcSuccess(id, toContent(this.toolService.getResult({
                        ref: String(args.ref || ""),
                        offset: Number(args.offset) || undefined,
                        limit: args.limit !== undefined ? Number(args.limit) : undefined,
                        fields: args.fields,
                        search: args.search ? String(args.search) : undefined,
                    })));
                default:
                    return jsonRpcError(id, -32602, `Unknown tool: ${toolName}. Available tools: gateway.search, gateway.describe, gateway.invoke, gateway.invoke_async, gateway.invoke_status, gateway.get_result`);
            }
        }
        catch (error) {
            if (error instanceof GatewayToolError) {
                return jsonRpcError(id, error.code, error.message);
            }
            return jsonRpcError(id, -32000, error.message);
        }
    }
}
function toContent(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}
//# sourceMappingURL=request-router.js.map