export type JsonRpcId = string | number | null;
export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id?: string | number;
    method: string;
    params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: JsonRpcId;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export declare function jsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcResponse;
export declare function jsonRpcError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse;
