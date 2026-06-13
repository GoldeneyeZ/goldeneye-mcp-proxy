import type { GatewayConfig } from "../shared/types.js";
import type { ResolvedSkillConfig } from "../skills/types.js";
export declare const DEFAULT_MAX_RESOURCE_BYTES: number;
export declare const DEFAULT_MAX_RESOURCE_ENTRIES = 50;
export declare function resolveSkillConfig(config: GatewayConfig, homeDir?: string): ResolvedSkillConfig;
