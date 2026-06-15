import type { SkillRegistry } from "./SkillRegistry.js";
import type { SkillResourcePolicy } from "./SkillResourcePolicy.js";
import type { SkillSearchEngine } from "./SkillSearchEngine.js";
import type { SkillRefreshSummary } from "./types.js";
export declare class SkillGatewayError extends Error {
    readonly code: number;
    constructor(message: string, code?: number);
}
export interface SkillGatewayServiceDeps {
    registry: SkillRegistry;
    searchEngine: SkillSearchEngine;
    resourcePolicy: SkillResourcePolicy;
    migrationPaths: {
        codexSkillsPath: string;
        deferredPath: string;
        agentsSkillsPath: string;
        agentsDeferredPath: string;
    };
}
export declare class SkillGatewayService {
    private readonly deps;
    private lastRefreshSummary?;
    constructor(deps: SkillGatewayServiceDeps);
    list(args: {
        source?: string;
        limit?: number;
        offset?: number;
    }): {
        count: number;
        offset: number;
        limit: number;
        skills: {
            id: string;
            name: string;
            description: string;
            source: string;
        }[];
    };
    search(args: {
        query?: string;
        limit?: number;
    }): {
        query: string;
        found: number;
        results: import("./types.js").SkillSearchResult[];
    };
    pull(args: {
        id: string;
    }): {
        id: string;
        name: string;
        description: string;
        source: string;
        path: string;
        hash: string;
        lastModified: string;
        content: string;
        resources: import("./types.js").SkillResourceEntry[];
    };
    readResource(args: {
        id: string;
        path: string;
    }): {
        path: string;
        content: string;
        size: number;
    };
    status(): {
        roots: {
            label: string;
            path: string;
            indexed: boolean;
            reason?: string;
        }[];
        skillCount: number;
        invalidSkillCount: number;
        invalidSkills: {
            path: string;
            reason: string;
        }[];
        lastRefreshedAt: string | undefined;
        migration: {
            codexSkillsPath: string;
            deferredPath: string;
            codexSkillsExists: boolean;
            deferredExists: boolean;
            agentsSkillsPath: string;
            agentsDeferredPath: string;
            agentsSkillsExists: boolean;
            agentsDeferredExists: boolean;
        };
    };
    startupLogLine(): string;
    refresh(reason?: string): SkillRefreshSummary;
    refreshLogLine(summary: SkillRefreshSummary): string;
    private buildRefreshSummary;
}
