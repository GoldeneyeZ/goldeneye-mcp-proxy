import type { ConnectionManager } from "../../upstreams/ConnectionManager.js";
import type { SearchEngine } from "../../search/SearchEngine.js";
import type { GatewayToolService } from "../../tools/GatewayToolService.js";
import type { SkillGatewayService } from "../../skills/SkillGatewayService.js";
export declare class HttpMcpServer {
    private readonly searchEngine;
    private readonly connections;
    private httpServer?;
    private readonly router;
    private readonly port;
    constructor(searchEngine: SearchEngine, connections: ConnectionManager, toolService: GatewayToolService, port?: number, skillService?: SkillGatewayService);
    start(): Promise<void>;
    shutdown(): Promise<void>;
    private handleHealth;
    private handleJsonRpc;
}
