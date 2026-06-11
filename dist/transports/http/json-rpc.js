export function jsonRpcSuccess(id, result) {
    return { jsonrpc: "2.0", id, result };
}
export function jsonRpcError(id, code, message, data) {
    const error = { code, message };
    if (data !== undefined)
        error.data = data;
    return { jsonrpc: "2.0", id, error };
}
//# sourceMappingURL=json-rpc.js.map