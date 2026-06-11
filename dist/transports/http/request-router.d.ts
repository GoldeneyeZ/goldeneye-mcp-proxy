import { GatewayToolService } from "../../tools/GatewayToolService.js";
import { type JsonRpcRequest, type JsonRpcResponse } from "./json-rpc.js";
export declare class HttpMcpRequestRouter {
    private readonly toolService;
    private initialized;
    constructor(toolService: GatewayToolService);
    route(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined>;
    private handleInitialize;
    private handleToolsList;
    private handleToolsCall;
}
