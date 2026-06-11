import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StatusHolder } from "../gateway/gateway-status.js";
import { GatewayToolService } from "./GatewayToolService.js";
export declare function createServer(toolService: GatewayToolService, statusHolder?: StatusHolder): McpServer;
