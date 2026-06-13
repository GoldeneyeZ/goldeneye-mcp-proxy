import { GatewayToolService } from "../../tools/GatewayToolService.js";
import { type SkillGatewayService } from "../../skills/SkillGatewayService.js";
import { type JsonRpcRequest, type JsonRpcResponse } from "./json-rpc.js";
export declare class HttpMcpRequestRouter {
    private readonly toolService;
    private readonly skillService?;
    private initialized;
    constructor(toolService: GatewayToolService, skillService?: SkillGatewayService | undefined);
    route(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined>;
    private handleInitialize;
    private handleToolsList;
    private handleToolsCall;
}
