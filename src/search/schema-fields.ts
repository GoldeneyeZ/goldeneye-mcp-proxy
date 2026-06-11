export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

export function extractFieldNames(schema: unknown): string[] {
  if (!schema || typeof schema !== "object") return [];

  const obj = schema as Record<string, unknown>;
  if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
    return Object.keys(obj.properties as Record<string, unknown>);
  }

  if (typeof obj.shape === "function") {
    try {
      const shape = (obj.shape as () => Record<string, unknown>)();
      return Object.keys(shape);
    } catch {
      return [];
    }
  }

  if (obj.inputSchema && typeof obj.inputSchema === "object") {
    return extractFieldNames(obj.inputSchema);
  }

  return [];
}
