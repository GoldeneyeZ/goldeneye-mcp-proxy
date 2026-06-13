import type { ResolvedSkillConfig, SkillRecord } from "./types.js";
export declare class SkillRegistry {
    private readonly config;
    private skills;
    private invalidSkills;
    private rootStatus;
    constructor(config: ResolvedSkillConfig);
    refresh(): void;
    getSkills(): SkillRecord[];
    getSkill(id: string): SkillRecord | undefined;
    getInvalidSkills(): Array<{
        path: string;
        reason: string;
    }>;
    getRootStatus(): Array<{
        label: string;
        path: string;
        indexed: boolean;
        reason?: string;
    }>;
}
