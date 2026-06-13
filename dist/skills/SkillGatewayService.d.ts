import type { SkillRegistry } from "./SkillRegistry.js";
import type { SkillResourcePolicy } from "./SkillResourcePolicy.js";
import type { SkillSearchEngine } from "./SkillSearchEngine.js";
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
    };
}
export declare class SkillGatewayService {
    private readonly deps;
    constructor(deps: SkillGatewayServiceDeps);
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
        migration: {
            codexSkillsPath: string;
            deferredPath: string;
            codexSkillsExists: boolean;
            deferredExists: boolean;
        };
    };
    refresh(): void;
}
