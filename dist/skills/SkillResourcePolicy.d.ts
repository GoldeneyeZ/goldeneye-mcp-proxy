import type { SkillResourceContext, SkillResourceEntry } from "./types.js";
export declare class SkillResourcePolicy {
    private readonly limits;
    constructor(limits: {
        maxResourceBytes: number;
        maxResourceEntries: number;
    });
    listResources(skill: SkillResourceContext, skillMarkdown: string): SkillResourceEntry[];
    readResource(skill: SkillResourceContext, resourcePath: string): {
        path: string;
        content: string;
        size: number;
    };
    private resolveResource;
    private listTextFiles;
    private hasSymlinkComponent;
}
