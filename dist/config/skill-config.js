import { homedir } from "node:os";
import { join } from "node:path";
export const DEFAULT_MAX_RESOURCE_BYTES = 128 * 1024;
export const DEFAULT_MAX_RESOURCE_ENTRIES = 50;
export function resolveSkillConfig(config, homeDir = homedir()) {
    const raw = (config._skills || {});
    const defaultSource = {
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
//# sourceMappingURL=skill-config.js.map