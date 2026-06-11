import http from "node:http";
import type { ConnectionManager } from "../../connections.js";
import type { SearchEngine } from "../../search/SearchEngine.js";
import type { GatewayToolService } from "../../tools/GatewayToolService.js";
import { applyCorsHeaders, handleCorsPreflight } from "./cors.js";
import { jsonRpcError, type JsonRpcRequest } from "./json-rpc.js";
import { HttpMcpRequestRouter } from "./request-router.js";

export class HttpMcpServer {
  private httpServer?: http.Server;
  private readonly router: HttpMcpRequestRouter;
  private readonly port: number;

  constructor(
    private readonly searchEngine: SearchEngine,
    private readonly connections: ConnectionManager,
    toolService: GatewayToolService,
    port?: number,
  ) {
    this.port = port || 8767;
    this.router = new HttpMcpRequestRouter(toolService);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = http.createServer((req, res) => {
        applyCorsHeaders(res);

        if (handleCorsPreflight(req, res)) {
          return;
        }

        if (req.method === "GET" && req.url === "/health") {
          this.handleHealth(res);
          return;
        }

        if (req.method === "POST" && (req.url === "/" || req.url === "/mcp")) {
          this.handleJsonRpc(req, res);
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      });

      this.httpServer.listen(this.port, () => {
        console.error(`  [http-server] Listening on port ${this.port}`);
        console.error(`  [http-server] MCP endpoint: POST http://localhost:${this.port}/mcp`);
        console.error(`  [http-server] Health check: GET http://localhost:${this.port}/health`);
        resolve();
      });

      this.httpServer.on("error", (err: Error) => {
        console.error(`  [http-server] Failed to start: ${err.message}`);
        process.exit(1);
      });
    });
  }

  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.httpServer) {
        this.httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleHealth(res: http.ServerResponse): void {
    const connectedServers = this.connections.getConnectedServers();
    const totalTools = this.searchEngine.getTools().length;
    const status = {
      status: "ok",
      servers: connectedServers.length,
      tools: totalTools,
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status));
  }

  private async handleJsonRpc(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", async () => {
      let request: JsonRpcRequest;
      try {
        request = JSON.parse(body) as JsonRpcRequest;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(jsonRpcError(null, -32700, "Parse error: invalid JSON")));
        return;
      }

      if (request.jsonrpc !== "2.0" || !request.method) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(jsonRpcError(request.id ?? null, -32600, "Invalid Request: must have jsonrpc and method")));
        return;
      }

      try {
        const response = await this.router.route(request);
        if (!response) {
          res.writeHead(202);
          res.end();
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify(jsonRpcError(request.id ?? null, -32603, `Internal error: ${message}`)));
      }
    });
  }
}
