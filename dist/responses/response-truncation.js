export const MAX_ARRAY_LENGTH = 50;
export const MAX_STRING_LENGTH = 8192;
export const MAX_RESPONSE_BYTES = 65536;
export const HEAVY_FIELD_THRESHOLD = 256;
const SIGNAL_FIELDS = new Set([
    "id", "name", "title", "type", "status", "state", "label",
    "sha", "ref", "path", "url", "html_url",
    "created_at", "updated_at", "number", "key",
    "message", "description", "summary", "error",
]);
export function deepClone(data) {
    return JSON.parse(JSON.stringify(data));
}
export function truncateArrays(data, onTruncate) {
    if (Array.isArray(data)) {
        if (data.length > MAX_ARRAY_LENGTH) {
            onTruncate(true);
            const kept = data.slice(0, MAX_ARRAY_LENGTH);
            return [
                ...kept,
                {
                    _truncated: true,
                    _total: data.length,
                    _showing: MAX_ARRAY_LENGTH,
                    _message: `[TRUNCATED: ${data.length - MAX_ARRAY_LENGTH} more items. Use gateway.get_result to paginate]`,
                },
            ];
        }
        return data.map((item) => truncateArrays(item, onTruncate));
    }
    if (data && typeof data === "object") {
        const obj = data;
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = truncateArrays(value, onTruncate);
        }
        return result;
    }
    if (typeof data === "string" && data.length > 1000) {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > MAX_ARRAY_LENGTH) {
                onTruncate(true);
                const kept = parsed.slice(0, MAX_ARRAY_LENGTH);
                kept.push({
                    _truncated: true,
                    _total: parsed.length,
                    _showing: MAX_ARRAY_LENGTH,
                    _message: `[TRUNCATED: ${parsed.length - MAX_ARRAY_LENGTH} more items. Use gateway.get_result to paginate]`,
                });
                return JSON.stringify(kept);
            }
        }
        catch {
            return data;
        }
    }
    return data;
}
export function stripHeavyFields(data, onStrip) {
    if (!data || typeof data !== "object")
        return data;
    if (Array.isArray(data) && data.length > 5) {
        const sampleSize = Math.min(data.length, 10);
        const sample = data.slice(0, sampleSize);
        if (sample.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
            const heavyFields = findHeavyFields(sample);
            if (heavyFields.length > 0) {
                onStrip(true);
                return data.map((item) => stripFields(item, heavyFields));
            }
        }
    }
    if (!Array.isArray(data)) {
        const obj = data;
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = stripHeavyFields(value, onStrip);
        }
        return result;
    }
    return data;
}
export function truncateStrings(data, onTruncate) {
    if (typeof data === "string") {
        if (data.length > MAX_STRING_LENGTH) {
            onTruncate(true);
            return data.slice(0, MAX_STRING_LENGTH) + `\n[...TRUNCATED: ${data.length - MAX_STRING_LENGTH} more chars]`;
        }
        return data;
    }
    if (Array.isArray(data)) {
        return data.map((item) => truncateStrings(item, onTruncate));
    }
    if (data && typeof data === "object") {
        const obj = data;
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = truncateStrings(value, onTruncate);
        }
        return result;
    }
    return data;
}
export function enforceMaxSize(data) {
    let current = deepClone(data);
    let iterations = 0;
    const maxIterations = 20;
    while (JSON.stringify(current).length > MAX_RESPONSE_BYTES && iterations < maxIterations) {
        iterations++;
        if (typeof current === "object" && current !== null) {
            const obj = current;
            shrinkContentText(obj);
            shrinkTopLevelArrays(obj);
        }
        if (typeof current === "string" && current.length > MAX_RESPONSE_BYTES) {
            current = current.slice(0, MAX_RESPONSE_BYTES - 100) +
                `\n[...TRUNCATED to fit 64KB limit]`;
        }
    }
    return current;
}
function findHeavyFields(sample) {
    const fieldSizes = new Map();
    const fieldCounts = new Map();
    for (const item of sample) {
        for (const [key, value] of Object.entries(item)) {
            const size = JSON.stringify(value).length;
            fieldSizes.set(key, (fieldSizes.get(key) || 0) + size);
            fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
        }
    }
    const heavyFields = [];
    for (const [field, totalSize] of fieldSizes) {
        const count = fieldCounts.get(field) || 1;
        const avg = totalSize / count;
        if (avg > HEAVY_FIELD_THRESHOLD && !SIGNAL_FIELDS.has(field)) {
            heavyFields.push(field);
        }
    }
    return heavyFields;
}
function stripFields(item, heavyFields) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        return item;
    }
    const obj = item;
    const stripped = {};
    for (const [key, value] of Object.entries(obj)) {
        if (!heavyFields.includes(key)) {
            stripped[key] = value;
        }
    }
    stripped._omitted = heavyFields;
    return stripped;
}
function shrinkContentText(obj) {
    if (!Array.isArray(obj.content))
        return;
    for (const item of obj.content) {
        if (!item || typeof item !== "object")
            continue;
        const contentItem = item;
        if (typeof contentItem.text === "string" && contentItem.text.length > 2000) {
            const text = contentItem.text;
            contentItem.text = text.slice(0, Math.floor(text.length / 2)) +
                `\n[...TRUNCATED to fit 64KB limit]`;
        }
    }
}
function shrinkTopLevelArrays(obj) {
    for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value) && value.length > 10) {
            const halfLen = Math.floor(value.length * 0.75);
            obj[key] = [
                ...value.slice(0, halfLen),
                {
                    _truncated: true,
                    _dropped: value.length - halfLen,
                    _message: "[Dropped items to fit 64KB response limit. Use gateway.get_result to paginate]",
                },
            ];
        }
    }
}
//# sourceMappingURL=response-truncation.js.map