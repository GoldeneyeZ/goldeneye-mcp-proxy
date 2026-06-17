import { existsSync, readFileSync } from "node:fs";
export class SkillGatewayError extends Error {
    code;
    constructor(message, code = -32602) {
        super(message);
        this.code = code;
    }
}
export class SkillGatewayService {
    deps;
    lastRefreshSummary;
    constructor(deps) {
        this.deps = deps;
    }
    list(args) {
        const limit = clampNumber(args.limit, 50, 1, 100);
        const offset = Math.max(0, Number(args.offset) || 0);
        const source = args.source ? String(args.source) : undefined;
        const allSkills = this.deps.registry.getSkills()
            .filter((skill) => !source || skill.source === source)
            .sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        const skills = allSkills.slice(offset, offset + limit).map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            source: skill.source,
        }));
        return {
            count: allSkills.length,
            offset,
            limit,
            skills,
        };
    }
    search(args) {
        const query = String(args.query || "");
        const results = this.deps.searchEngine.search(query, args.limit || 10);
        return {
            query,
            found: results.length,
            results,
        };
    }
    pull(args) {
        const skill = this.deps.registry.getSkill(args.id);
        if (!skill)
            throw new SkillGatewayError(`Skill not found: ${args.id}`);
        const content = readFileSync(skill.skillPath, "utf-8");
        return {
            id: skill.id,
            name: skill.name,
            description: skill.description,
            source: skill.source,
            path: skill.relativePath,
            hash: skill.hash,
            lastModified: skill.lastModified,
            content,
            resources: this.deps.resourcePolicy.listResources(skill, content),
        };
    }
    readResource(args) {
        const skill = this.deps.registry.getSkill(args.id);
        if (!skill)
            throw new SkillGatewayError(`Skill not found: ${args.id}`);
        return this.deps.resourcePolicy.readResource(skill, args.path);
    }
    status() {
        return {
            roots: this.deps.registry.getRootStatus(),
            skillCount: this.deps.registry.getSkills().length,
            invalidSkillCount: this.deps.registry.getInvalidSkills().length,
            invalidSkills: this.deps.registry.getInvalidSkills(),
            lastRefreshedAt: this.lastRefreshSummary?.refreshedAt,
            migration: {
                codexSkillsPath: this.deps.migrationPaths.codexSkillsPath,
                deferredPath: this.deps.migrationPaths.deferredPath,
                codexSkillsExists: existsSync(this.deps.migrationPaths.codexSkillsPath),
                deferredExists: existsSync(this.deps.migrationPaths.deferredPath),
                agentsSkillsPath: this.deps.migrationPaths.agentsSkillsPath,
                agentsDeferredPath: this.deps.migrationPaths.agentsDeferredPath,
                agentsSkillsExists: existsSync(this.deps.migrationPaths.agentsSkillsPath),
                agentsDeferredExists: existsSync(this.deps.migrationPaths.agentsDeferredPath),
            },
        };
    }
    startupLogLine() {
        const summary = this.lastRefreshSummary || this.buildRefreshSummary("startup", new Date().toISOString());
        return this.refreshLogLine(summary);
    }
    refresh(reason = "manual") {
        this.deps.registry.refresh();
        this.deps.searchEngine.replaceAll(this.deps.registry.getSkills());
        this.lastRefreshSummary = this.buildRefreshSummary(reason, new Date().toISOString());
        return this.lastRefreshSummary;
    }
    refreshLogLine(summary) {
        const missingRoots = summary.roots.filter((root) => !root.indexed);
        const missingSuffix = missingRoots.length > 0
            ? `; missing roots: ${missingRoots.map((root) => `${root.label}=${root.path}`).join(", ")}`
            : "";
        return `  [skills] Deferred skills indexed: ${summary.skillCount} ${plural(summary.skillCount, "skill")} across ${summary.indexedRootCount} ${plural(summary.indexedRootCount, "root")} (${summary.reason} refresh at ${summary.refreshedAt})${missingSuffix}`;
    }
    buildRefreshSummary(reason, refreshedAt) {
        const roots = this.deps.registry.getRootStatus();
        return {
            reason,
            refreshedAt,
            roots,
            skillCount: this.deps.registry.getSkills().length,
            indexedRootCount: roots.filter((root) => root.indexed).length,
            invalidSkillCount: this.deps.registry.getInvalidSkills().length,
        };
    }
}
function plural(count, singular) {
    return count === 1 ? singular : `${singular}s`;
}
function clampNumber(value, defaultValue, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return defaultValue;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
//# sourceMappingURL=SkillGatewayService.js.map