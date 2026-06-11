import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { ProjectRegistry } from "../projects/ProjectRegistry.js";
import type { ResponseShield } from "../responses/ResponseShield.js";
import type { ResponseStore } from "../responses/ResponseStore.js";
import type { SearchEngine } from "../search/SearchEngine.js";
import type { SearchFilters } from "../shared/types.js";
import type { ConnectionManager } from "../upstreams/ConnectionManager.js";
import { injectProjectPath } from "../gateway/project-args.js";

export interface GatewayToolServiceDeps {
  searchEngine: SearchEngine;
  connections: ConnectionManager;
  jobManager: JobManager;
  responseStore: ResponseStore;
  responseShield: ResponseShield;
  projectRegistry?: ProjectRegistry;
}

export class GatewayToolError extends Error {
  constructor(
    message: string,
    public readonly code: number = -32602,
  ) {
    super(message);
  }
}

export class GatewayToolService {
  constructor(private readonly deps: GatewayToolServiceDeps) {}

  search(args: { query?: string; limit?: number; server?: string }) {
    const query = String(args.query || "");
    const filters: SearchFilters = {};
    if (args.server) filters.server = args.server;
    const results = this.deps.searchEngine.search(query, filters, args.limit || 10);

    return {
      query,
      found: results.length,
      connectedServers: this.deps.connections.getConnectedServers(),
      results: results.map((result) => ({
        id: result.id,
        name: result.name,
        displayName: result.displayName,
        server: result.server,
        connected: this.deps.connections.getConnectionState(result.server) === "connected",
        description: result.description
          ? result.description.slice(0, 120) + (result.description.length > 120 ? "..." : "")
          : undefined,
        fieldNames: result.fieldNames,
        score: Math.round(result.score * 100) / 100,
      })),
    };
  }

  describe(args: { id: string }) {
    const tool = this.deps.searchEngine.getSchema(args.id);
    if (!tool) throw new GatewayToolError(`Tool not found: ${args.id}`);

    return {
      id: tool.id,
      server: tool.server,
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    };
  }

  async invoke(args: { id: string; args: Record<string, unknown>; timeoutMs?: number }) {
    const { serverKey, toolName } = parseToolId(args.id);
    const client = await this.getClient(serverKey);
    const tool = this.deps.searchEngine.getTool(args.id);
    if (!tool) throw new GatewayToolError(`Tool not found in catalog: ${args.id}`);

    const timeout = args.timeoutMs || 60_000;
    const finalArgs = injectProjectPath(serverKey, args.args || {}, this.deps.projectRegistry);
    const result = await Promise.race([
      client.callTool({ name: toolName, arguments: finalArgs }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`TIMEOUT: Tool ${args.id} exceeded ${timeout}ms`)), timeout),
      ),
    ]);

    return this.withTruncationMetadata(args.id, result);
  }

  invokeAsync(args: { id: string; args: Record<string, unknown>; priority?: number }) {
    const job = this.deps.jobManager.createJob(args.id, args.args || {}, args.priority || 0);
    this.deps.jobManager.processQueue();
    return { jobId: job.id, status: "queued", toolId: args.id };
  }

  invokeStatus(args: { jobId: string }) {
    const job = this.deps.jobManager.getJob(args.jobId);
    if (!job) throw new GatewayToolError(`Job not found: ${args.jobId}`);
    return {
      jobId: job.id,
      status: job.status,
      toolId: job.toolId,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      result: job.result,
      error: job.error,
      logs: job.logs,
    };
  }

  getResult(args: { ref: string; offset?: number; limit?: number; fields?: string[]; search?: string }) {
    const result = this.deps.responseStore.query(args.ref, {
      offset: args.offset,
      limit: args.limit,
      fields: args.fields,
      search: args.search,
    });
    if ("error" in result) throw new GatewayToolError(result.error);
    return { ...result.meta, data: result.data };
  }

  private async getClient(serverKey: string): Promise<Client> {
    try {
      const client = this.deps.connections.getClient(serverKey) || await this.deps.connections.ensureConnected(serverKey);
      this.deps.connections.markServerUsed(serverKey);
      return client;
    } catch (error) {
      throw new GatewayToolError(`Could not connect to server: ${serverKey}. ${(error as Error).message}`, -32000);
    }
  }

  private withTruncationMetadata(toolId: string, raw: unknown) {
    const { shielded, ref } = this.deps.responseShield.shield(toolId, raw);
    if (ref && typeof shielded === "object" && shielded !== null) {
      return {
        ...(shielded as Record<string, unknown>),
        _ref: ref,
        _truncated: true,
        _note: `Response was truncated. Use gateway.get_result with ref "${ref}" to access the full data.`,
      };
    }
    return shielded;
  }
}

function parseToolId(toolId: string): { serverKey: string; toolName: string } {
  const separatorIndex = toolId.indexOf("::");
  if (separatorIndex === -1) {
    throw new GatewayToolError(`Invalid tool ID format: ${toolId}. Expected "serverKey::toolName"`);
  }
  return {
    serverKey: toolId.slice(0, separatorIndex),
    toolName: toolId.slice(separatorIndex + 2),
  };
}
