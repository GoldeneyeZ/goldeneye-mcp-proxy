import type { SkillRecord, SkillSearchResult } from "./types.js";
export declare class SkillSearchEngine {
    private records;
    private miniSearch;
    replaceAll(records: SkillRecord[]): void;
    search(query: string, limit?: number): SkillSearchResult[];
}
