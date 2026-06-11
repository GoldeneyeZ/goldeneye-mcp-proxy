import type { ConnectionManager } from "../connections.js";
import type { JobManager } from "../jobs/JobManager.js";
import type { ProjectRegistry } from "../projects/ProjectRegistry.js";
import type { ResponseShield, ResponseStore } from "../response-store.js";
import type { SearchEngine } from "../search/SearchEngine.js";
export interface GatewayToolServiceDeps {
    searchEngine: SearchEngine;
    connections: ConnectionManager;
    jobManager: JobManager;
    responseStore: ResponseStore;
    responseShield: ResponseShield;
    projectRegistry?: ProjectRegistry;
}
export declare class GatewayToolError extends Error {
    readonly code: number;
    constructor(message: string, code?: number);
}
export declare class GatewayToolService {
    private readonly deps;
    constructor(deps: GatewayToolServiceDeps);
    search(args: {
        query?: string;
        limit?: number;
        server?: string;
    }): {
        query: string;
        found: number;
        connectedServers: string[];
        results: {
            id: string;
            name: string;
            displayName: string | undefined;
            server: string;
            connected: boolean;
            description: string | undefined;
            fieldNames: string[] | undefined;
            score: number;
        }[];
    };
    describe(args: {
        id: string;
    }): {
        id: string;
        server: string;
        name: string;
        title: string | undefined;
        description: string | undefined;
        inputSchema: unknown;
        outputSchema: unknown;
    };
    invoke(args: {
        id: string;
        args: Record<string, unknown>;
        timeoutMs?: number;
    }): Promise<unknown>;
    invokeAsync(args: {
        id: string;
        args: Record<string, unknown>;
        priority?: number;
    }): {
        jobId: string;
        status: string;
        toolId: string;
    };
    invokeStatus(args: {
        jobId: string;
    }): {
        jobId: string;
        status: "failed" | "queued" | "running" | "completed";
        toolId: string;
        createdAt: number;
        startedAt: number | undefined;
        finishedAt: number | undefined;
        result: unknown;
        error: string | undefined;
        logs: string[];
    };
    getResult(args: {
        ref: string;
        offset?: number;
        limit?: number;
        fields?: string[];
        search?: string;
    }): {
        data: unknown;
        ref: string;
        total: number;
        offset: number;
        count: number;
        hasMore: boolean;
    };
    private getClient;
    private withTruncationMetadata;
}
