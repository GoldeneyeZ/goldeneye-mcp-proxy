import MiniSearch from "minisearch";
import type { SkillRecord, SkillSearchResult } from "./types.js";

interface SkillSearchDocument extends SkillRecord {
  headingText: string;
}

export class SkillSearchEngine {
  private records = new Map<string, SkillRecord>();
  private miniSearch: any = null;

  replaceAll(records: SkillRecord[]): void {
    this.records = new Map(records.map((record) => [record.id, record]));

    if (records.length === 0) {
      this.miniSearch = null;
      return;
    }

    const MiniSearchCtor = MiniSearch as unknown as new (options: Record<string, unknown>) => any;
    this.miniSearch = new MiniSearchCtor({
      fields: ["name", "description", "source", "relativePath", "headingText"],
      storeFields: ["id", "name", "description", "source", "relativePath", "hash", "lastModified"],
      searchOptions: {
        boost: { name: 3, description: 2, headingText: 1.5 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: "OR",
      },
    });

    this.miniSearch.addAll(records.map((record) => ({
      ...record,
      headingText: record.headings.join(" "),
    })));
  }

  search(query: string, limit = 10): SkillSearchResult[] {
    const maxLimit = Math.min(limit, 50);

    if (!query.trim()) {
      return Array.from(this.records.values()).slice(0, maxLimit).map((record) => toResult(record, 0));
    }

    if (!this.miniSearch) return [];

    return this.miniSearch.search(query.toLowerCase())
      .slice(0, maxLimit)
      .map((result: { id: string; score?: number }) => {
        const record = this.records.get(result.id as string);
        return record ? toResult(record, result.score || 0) : undefined;
      })
      .filter((result: SkillSearchResult | undefined): result is SkillSearchResult => Boolean(result));
  }
}

function toResult(record: SkillRecord, score: number): SkillSearchResult {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    source: record.source,
    path: record.relativePath,
    hash: record.hash,
    lastModified: record.lastModified,
    score: Math.round(score * 100) / 100,
  };
}
