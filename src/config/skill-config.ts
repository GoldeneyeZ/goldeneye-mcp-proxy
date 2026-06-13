import { homedir } from "node:os";
import { join } from "node:path";
import type { GatewayConfig } from "../shared/types.js";
import type { ResolvedSkillConfig, SkillGatewayConfig, SkillSourceConfig } from "../skills/types.js";

export const DEFAULT_MAX_RESOURCE_BYTES = 128 * 1024;
export const DEFAULT_MAX_RESOURCE_ENTRIES = 50;

export function resolveSkillConfig(config: GatewayConfig, homeDir = homedir()): ResolvedSkillConfig {
  const raw = (config._skills || {}) as SkillGatewayConfig;
  const defaultSource: SkillSourceConfig = {
    label: "codex-deferred",
    path: join(homeDir, ".codex", "skills.deferred"),
    enabled: true,
  };

  const customSources = (raw.sources || [])
    .map((source) => ({
      label: source.label,
      path: source.path,
      enabled: source.enabled !== false,
    }))
    .filter((source) => source.enabled);

  return {
    sources: [defaultSource, ...customSources],
    maxResourceBytes: raw.maxResourceBytes || DEFAULT_MAX_RESOURCE_BYTES,
    maxResourceEntries: raw.maxResourceEntries || DEFAULT_MAX_RESOURCE_ENTRIES,
  };
}
