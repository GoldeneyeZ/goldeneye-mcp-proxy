import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const MARKER = "Global Codex skills are deferred through goldeneye-mcp-proxy.";
const AGENTS_MARKER = "Global Agents skills are deferred through goldeneye-mcp-proxy.";
export class SkillMigrationService {
    codexTarget;
    agentsTarget;
    constructor(homeDir = homedir()) {
        this.codexTarget = {
            name: "Codex",
            resultPathKey: "codexSkillsPath",
            skillsPath: join(homeDir, ".codex", "skills"),
            deferredPath: join(homeDir, ".codex", "skills.deferred"),
            marker: MARKER,
        };
        this.agentsTarget = {
            name: "Agents",
            resultPathKey: "agentsSkillsPath",
            skillsPath: join(homeDir, ".agents", "skills"),
            deferredPath: join(homeDir, ".agents", "skills.deferred"),
            marker: AGENTS_MARKER,
        };
    }
    deferCodexSkills(options) {
        return this.defer(this.codexTarget, options);
    }
    deferAgentsSkills(options) {
        return this.defer(this.agentsTarget, options);
    }
    restoreCodexSkills(options) {
        return this.restore(this.codexTarget, options);
    }
    restoreAgentsSkills(options) {
        return this.restore(this.agentsTarget, options);
    }
    defer(target, options) {
        if (!existsSync(target.skillsPath)) {
            throw new Error(`${target.name} skills directory does not exist: ${target.skillsPath}`);
        }
        if (existsSync(target.deferredPath)) {
            throw new Error(`Deferred skills directory already exists: ${target.deferredPath}`);
        }
        const message = `Would rename ${target.skillsPath} to ${target.deferredPath} and create marker directory`;
        if (options.dryRun) {
            return this.result(target, false, message);
        }
        renameSync(target.skillsPath, target.deferredPath);
        mkdirSync(target.skillsPath, { recursive: true });
        writeFileSync(join(target.skillsPath, "README.md"), `${target.marker}\n\nUse skills.search and skills.pull from the MCP gateway.\n`, "utf-8");
        return this.result(target, true, message.replace("Would rename", "Renamed"));
    }
    restore(target, options) {
        if (!existsSync(target.deferredPath)) {
            throw new Error(`Deferred skills directory does not exist: ${target.deferredPath}`);
        }
        if (existsSync(target.skillsPath) && !isMarkerDirectory(target.skillsPath, target.marker)) {
            throw new Error(`${target.skillsPath} is not the migration marker directory`);
        }
        const message = `Would restore ${target.deferredPath} to ${target.skillsPath}`;
        if (options.dryRun) {
            return this.result(target, false, message);
        }
        if (existsSync(target.skillsPath)) {
            rmSync(target.skillsPath, { recursive: true, force: true });
        }
        renameSync(target.deferredPath, target.skillsPath);
        return this.result(target, true, message.replace("Would restore", "Restored"));
    }
    result(target, changed, message) {
        return {
            changed,
            message,
            skillsPath: target.skillsPath,
            [target.resultPathKey]: target.skillsPath,
            deferredPath: target.deferredPath,
        };
    }
}
function isMarkerDirectory(path, marker) {
    const entries = readdirSync(path);
    if (entries.length !== 1 || entries[0] !== "README.md")
        return false;
    const content = readFileSync(join(path, "README.md"), "utf-8");
    return content.includes(marker) || content.includes(MARKER);
}
//# sourceMappingURL=SkillMigrationService.js.map