/**
 * types.ts — All interfaces for goldeneye-mcp-proxy.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Three layers of types:                                        │
 * │  1. Config types — what lives in config.json                   │
 * │  2. Catalog types — the compressed tool index (schema deferral)│
 * │  3. Store types — response shielding + pagination refs         │
 * └─────────────────────────────────────────────────────────────────┘
 */
export function isUpstreamConfig(value) {
    if (!value || typeof value !== "object")
        return false;
    const type = value.type;
    return type === "local" || type === "remote";
}
//# sourceMappingURL=types.js.map