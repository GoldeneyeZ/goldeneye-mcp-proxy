export function toCamelCase(str) {
    return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
        .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}
export function extractFieldNames(schema) {
    if (!schema || typeof schema !== "object")
        return [];
    const obj = schema;
    if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
        return Object.keys(obj.properties);
    }
    if (typeof obj.shape === "function") {
        try {
            const shape = obj.shape();
            return Object.keys(shape);
        }
        catch {
            return [];
        }
    }
    if (obj.inputSchema && typeof obj.inputSchema === "object") {
        return extractFieldNames(obj.inputSchema);
    }
    return [];
}
//# sourceMappingURL=schema-fields.js.map