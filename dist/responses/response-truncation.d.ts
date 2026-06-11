export declare const MAX_ARRAY_LENGTH = 50;
export declare const MAX_STRING_LENGTH = 8192;
export declare const MAX_RESPONSE_BYTES = 65536;
export declare const HEAVY_FIELD_THRESHOLD = 256;
export declare function deepClone<T>(data: T): T;
export declare function truncateArrays(data: unknown, onTruncate: (v: boolean) => void): unknown;
export declare function stripHeavyFields(data: unknown, onStrip: (v: boolean) => void): unknown;
export declare function truncateStrings(data: unknown, onTruncate: (v: boolean) => void): unknown;
export declare function enforceMaxSize(data: unknown): unknown;
