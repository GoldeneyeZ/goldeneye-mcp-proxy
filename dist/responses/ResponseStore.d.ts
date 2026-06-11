import type { SliceMeta, StoredResponse } from "../shared/types.js";
export declare class ResponseStore {
    private readonly entries;
    private readonly order;
    private counter;
    store(toolId: string, full: unknown): string;
    get(ref: string): StoredResponse | undefined;
    query(ref: string, opts?: {
        offset?: number;
        limit?: number;
        fields?: string[];
        search?: string;
    }): {
        data: unknown;
        meta: SliceMeta;
    } | {
        error: string;
    };
    summary(): Record<string, {
        toolId: string;
        byteSize: number;
        timestamp: number;
    }>;
    private queryArray;
    private queryString;
    private projectFields;
}
