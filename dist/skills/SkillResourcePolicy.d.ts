import type { SkillResourceEntry } from "./types.js";
export declare class SkillResourcePolicy {
    private readonly limits;
    constructor(limits: {
        maxResourceBytes: number;
        maxResourceEntries: number;
    });
    listResources(skillDir: string, skillMarkdown: string): SkillResourceEntry[];
    readResource(skillDir: string, resourcePath: string): {
        path: string;
        content: string;
        size: number;
    };
    private resolveInside;
    private listTextFiles;
}
