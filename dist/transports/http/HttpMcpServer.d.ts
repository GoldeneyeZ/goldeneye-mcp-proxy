import type { ConnectionManager } from "../../connections.js";
import type { SearchEngine } from "../../search/SearchEngine.js";
import type { GatewayToolService } from "../../tools/GatewayToolService.js";
export declare class HttpMcpServer {
    private readonly searchEngine;
    private readonly connections;
    private readonly toolService;
    private httpServer?;
    private readonly router;
    private readonly port;
    constructor(searchEngine: SearchEngine, connections: ConnectionManager, toolService: GatewayToolService, port?: number);
    start(): Promise<void>;
    shutdown(): Promise<void>;
    private handleHealth;
    private handleJsonRpc;
}
