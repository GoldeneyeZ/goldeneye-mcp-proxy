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
    constructor(deps) {
        this.deps = deps;
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
            resources: this.deps.resourcePolicy.listResources(skill.skillDir, content),
        };
    }
    readResource(args) {
        const skill = this.deps.registry.getSkill(args.id);
        if (!skill)
            throw new SkillGatewayError(`Skill not found: ${args.id}`);
        return this.deps.resourcePolicy.readResource(skill.skillDir, args.path);
    }
    status() {
        return {
            roots: this.deps.registry.getRootStatus(),
            skillCount: this.deps.registry.getSkills().length,
            invalidSkillCount: this.deps.registry.getInvalidSkills().length,
            invalidSkills: this.deps.registry.getInvalidSkills(),
            migration: {
                codexSkillsPath: this.deps.migrationPaths.codexSkillsPath,
                deferredPath: this.deps.migrationPaths.deferredPath,
                codexSkillsExists: existsSync(this.deps.migrationPaths.codexSkillsPath),
                deferredExists: existsSync(this.deps.migrationPaths.deferredPath),
            },
        };
    }
    refresh() {
        this.deps.registry.refresh();
        this.deps.searchEngine.replaceAll(this.deps.registry.getSkills());
    }
}
//# sourceMappingURL=SkillGatewayService.js.map