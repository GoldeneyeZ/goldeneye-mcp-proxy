import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".sh", ".py", ".yml", ".yaml"]);
const DIRECT_RESOURCE_NAMES = ["references", "shared", "scripts", "assets"];
const EXPANDABLE_RESOURCE_DIRS = new Set(["scripts", "references", "shared"]);
export class SkillResourcePolicy {
    limits;
    constructor(limits) {
        this.limits = limits;
    }
    listResources(skillDir, skillMarkdown) {
        const entries = [];
        const seen = new Set();
        const addEntry = (entry) => {
            if (entries.length >= this.limits.maxResourceEntries)
                return;
            const normalized = normalizePath(entry.path);
            if (seen.has(normalized))
                return;
            seen.add(normalized);
            entries.push({ ...entry, path: normalized });
        };
        for (const name of DIRECT_RESOURCE_NAMES) {
            const path = join(skillDir, name);
            if (existsSync(path)) {
                const stats = statSync(path);
                addEntry({
                    path: name,
                    type: stats.isDirectory() ? "directory" : "file",
                    size: stats.isFile() ? stats.size : undefined,
                });
            }
        }
        for (const name of DIRECT_RESOURCE_NAMES) {
            if (!EXPANDABLE_RESOURCE_DIRS.has(name))
                continue;
            const path = join(skillDir, name);
            if (existsSync(path) && statSync(path).isDirectory()) {
                this.listTextFiles(skillDir, path, name, addEntry);
            }
        }
        for (const linkedPath of extractMarkdownLinks(skillMarkdown)) {
            if (entries.length >= this.limits.maxResourceEntries)
                break;
            try {
                const fullPath = this.resolveInside(skillDir, linkedPath);
                if (!existsSync(fullPath))
                    continue;
                const stats = statSync(fullPath);
                addEntry({
                    path: normalizePath(linkedPath),
                    type: stats.isDirectory() ? "directory" : "file",
                    size: stats.isFile() ? stats.size : undefined,
                });
            }
            catch {
                addEntry({ path: linkedPath, type: "file", reason: "Rejected by resource policy" });
            }
        }
        return entries;
    }
    readResource(skillDir, resourcePath) {
        const fullPath = this.resolveInside(skillDir, resourcePath);
        const stats = statSync(fullPath);
        if (!stats.isFile()) {
            throw new Error(`Resource is not a file: ${resourcePath}`);
        }
        if (stats.size > this.limits.maxResourceBytes) {
            throw new Error(`Resource exceeds max size of ${this.limits.maxResourceBytes} bytes: ${resourcePath}`);
        }
        if (!isTextPath(resourcePath)) {
            throw new Error(`Unsupported resource file type: ${resourcePath}`);
        }
        return {
            path: normalizePath(resourcePath),
            content: readFileSync(fullPath, "utf-8"),
            size: stats.size,
        };
    }
    resolveInside(skillDir, resourcePath) {
        if (isAbsolute(resourcePath)) {
            throw new Error("Resource path must be relative");
        }
        const realSkillDir = realpathSync(skillDir);
        const fullPath = resolve(realSkillDir, resourcePath);
        const lexicalRel = relative(realSkillDir, fullPath);
        if (lexicalRel.startsWith("..") || isAbsolute(lexicalRel)) {
            throw new Error("Resource path must stay inside the skill directory");
        }
        const realTarget = realpathSync(fullPath);
        const rel = relative(realSkillDir, realTarget);
        if (rel.startsWith("..") || isAbsolute(rel)) {
            throw new Error("Resource path must stay inside the skill directory");
        }
        if (lstatSync(fullPath).isSymbolicLink()) {
            const symlinkRel = relative(realSkillDir, realTarget);
            if (symlinkRel.startsWith("..") || isAbsolute(symlinkRel)) {
                throw new Error("Resource path must stay inside the skill directory");
            }
        }
        return fullPath;
    }
    listTextFiles(skillDir, rootPath, rootResourcePath, addEntry) {
        const pending = [{ path: rootPath, resourcePath: rootResourcePath }];
        const visited = new Set();
        while (pending.length > 0) {
            const current = pending.pop();
            const realCurrent = realpathSync(current.path);
            if (visited.has(realCurrent))
                continue;
            visited.add(realCurrent);
            for (const entry of readdirSync(current.path, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name))) {
                const resourcePath = normalizePath(`${current.resourcePath}/${entry.name}`);
                let fullPath;
                let stats;
                try {
                    fullPath = this.resolveInside(skillDir, resourcePath);
                    stats = statSync(fullPath);
                }
                catch {
                    addEntry({ path: resourcePath, type: "file", reason: "Rejected by resource policy" });
                    continue;
                }
                if (stats.isDirectory()) {
                    pending.push({ path: fullPath, resourcePath });
                }
                else if (stats.isFile() && isTextPath(resourcePath)) {
                    addEntry({ path: resourcePath, type: "file", size: stats.size });
                }
            }
        }
    }
}
function extractMarkdownLinks(markdown) {
    return Array.from(markdown.matchAll(/\[[^\]]+]\(([^)]+)\)/g))
        .map((match) => match[1])
        .filter((path) => !path.includes("://") && !path.startsWith("#"));
}
function normalizePath(path) {
    return path.split(sep).join("/");
}
function isTextPath(path) {
    const dot = basename(path).lastIndexOf(".");
    if (dot === -1)
        return false;
    return TEXT_EXTENSIONS.has(basename(path).slice(dot).toLowerCase());
}
//# sourceMappingURL=SkillResourcePolicy.js.map