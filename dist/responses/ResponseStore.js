import { extractArray } from "./response-slicing.js";
const MAX_STORED_RESPONSES = 100;
const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 50;
const STRING_CHARS_PER_LIMIT_UNIT = 200;
export class ResponseStore {
    entries = new Map();
    order = [];
    counter = 0;
    store(toolId, full) {
        this.counter++;
        const ref = `r${this.counter}`;
        const entry = {
            ref,
            toolId,
            timestamp: Date.now(),
            full,
            truncated: true,
            byteSize: JSON.stringify(full).length,
        };
        this.entries.set(ref, entry);
        this.order.push(ref);
        while (this.entries.size > MAX_STORED_RESPONSES) {
            const oldest = this.order.shift();
            if (oldest)
                this.entries.delete(oldest);
        }
        return ref;
    }
    get(ref) {
        return this.entries.get(ref);
    }
    query(ref, opts = {}) {
        const entry = this.entries.get(ref);
        if (!entry)
            return { error: `Result ${ref} not found or expired` };
        const offset = opts.offset ?? 0;
        const limit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
        const arr = extractArray(entry.full);
        if (arr) {
            return this.queryArray(ref, arr, offset, limit, opts);
        }
        return this.queryString(ref, entry.full, offset, limit, opts.search);
    }
    summary() {
        const result = {};
        for (const [ref, entry] of this.entries) {
            result[ref] = {
                toolId: entry.toolId,
                byteSize: entry.byteSize,
                timestamp: entry.timestamp,
            };
        }
        return result;
    }
    queryArray(ref, arr, offset, limit, opts) {
        let items = arr;
        if (opts.search) {
            const needle = opts.search.toLowerCase();
            items = items.filter((item) => JSON.stringify(item).toLowerCase().includes(needle));
        }
        const total = items.length;
        const sliced = items.slice(offset, offset + limit);
        const projected = opts.fields && opts.fields.length > 0
            ? this.projectFields(sliced, opts.fields)
            : sliced;
        return {
            data: projected,
            meta: {
                ref,
                total,
                offset,
                count: projected.length,
                hasMore: offset + limit < total,
            },
        };
    }
    queryString(ref, full, offset, limit, search) {
        const fullStr = typeof full === "string" ? full : JSON.stringify(full, null, 2);
        if (search) {
            const needle = search.toLowerCase();
            const matches = fullStr.split("\n").filter((line) => line.toLowerCase().includes(needle));
            return {
                data: matches.slice(offset, offset + limit).join("\n"),
                meta: {
                    ref,
                    total: matches.length,
                    offset,
                    count: Math.min(limit, matches.length - offset),
                    hasMore: offset + limit < matches.length,
                },
            };
        }
        const chunk = fullStr.slice(offset, offset + limit * STRING_CHARS_PER_LIMIT_UNIT);
        return {
            data: chunk,
            meta: {
                ref,
                total: fullStr.length,
                offset,
                count: chunk.length,
                hasMore: offset + chunk.length < fullStr.length,
            },
        };
    }
    projectFields(items, fields) {
        return items.map((item) => {
            if (typeof item !== "object" || item === null || Array.isArray(item)) {
                return item;
            }
            const source = item;
            const projected = {};
            for (const field of fields) {
                if (field in source) {
                    projected[field] = source[field];
                }
            }
            return projected;
        });
    }
}
//# sourceMappingURL=ResponseStore.js.map