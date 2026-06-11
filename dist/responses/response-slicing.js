export function extractArray(data) {
    if (Array.isArray(data))
        return data;
    if (data && typeof data === "object") {
        const obj = data;
        for (const key of ["content", "items", "data", "results", "entries", "tools"]) {
            if (Array.isArray(obj[key]))
                return obj[key];
        }
        if (Array.isArray(obj.content)) {
            for (const item of obj.content) {
                if (item.type === "text" && typeof item.text === "string") {
                    const parsedArray = extractArrayFromJsonText(item.text);
                    if (parsedArray)
                        return parsedArray;
                }
            }
        }
    }
    return null;
}
function extractArrayFromJsonText(text) {
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed))
            return parsed;
        if (parsed && typeof parsed === "object") {
            const obj = parsed;
            for (const key of ["content", "items", "data", "results"]) {
                if (Array.isArray(obj[key]))
                    return obj[key];
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
//# sourceMappingURL=response-slicing.js.map