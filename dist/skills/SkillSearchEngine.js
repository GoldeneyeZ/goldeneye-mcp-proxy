import MiniSearch from "minisearch";
export class SkillSearchEngine {
    records = new Map();
    miniSearch = null;
    replaceAll(records) {
        this.records = new Map(records.map((record) => [record.id, record]));
        if (records.length === 0) {
            this.miniSearch = null;
            return;
        }
        const MiniSearchCtor = MiniSearch;
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
    search(query, limit = 10) {
        const maxLimit = Math.min(limit, 50);
        if (!query.trim()) {
            return Array.from(this.records.values()).slice(0, maxLimit).map((record) => toResult(record, 0));
        }
        if (!this.miniSearch)
            return [];
        return this.miniSearch.search(query.toLowerCase())
            .slice(0, maxLimit)
            .map((result) => {
            const record = this.records.get(result.id);
            return record ? toResult(record, result.score || 0) : undefined;
        })
            .filter((result) => Boolean(result));
    }
}
function toResult(record, score) {
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
//# sourceMappingURL=SkillSearchEngine.js.map