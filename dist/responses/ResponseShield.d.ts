import type { ShieldResult } from "../shared/types.js";
import { ResponseStore } from "./ResponseStore.js";
export declare class ResponseShield {
    private readonly responseStore;
    constructor(responseStore: ResponseStore);
    shield(toolId: string, raw: unknown): ShieldResult;
}
