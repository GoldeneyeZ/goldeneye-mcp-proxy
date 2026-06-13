import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { extractMarkdownHeadings, parseSkillMarkdown } from "./skill-frontmatter.js";
export class SkillRegistry {
    config;
    skills = [];
    invalidSkills = [];
    rootStatus = [];
    constructor(config) {
        this.config = config;
    }
    refresh() {
        this.skills = [];
        this.invalidSkills = [];
        this.rootStatus = [];
        for (const source of this.config.sources) {
            if (!existsSync(source.path)) {
                this.rootStatus.push({ label: source.label, path: source.path, indexed: false, reason: "Root does not exist" });
                continue;
            }
            this.rootStatus.push({ label: source.label, path: source.path, indexed: true });
            for (const skillPath of findSkillFiles(source.path)) {
                try {
                    const markdown = readFileSync(skillPath, "utf-8");
                    const parsed = parseSkillMarkdown(markdown);
                    const stats = statSync(skillPath);
                    const skillDir = skillPath.replace(/[/\\]SKILL\.md$/, "");
                    const relativePath = normalizePath(relative(source.path, skillDir));
                    this.skills.push({
                        id: `${source.label}::${relativePath}`,
                        name: parsed.frontmatter.name,
                        description: parsed.frontmatter.description,
                        source: source.label,
                        rootPath: source.path,
                        skillDir,
                        skillPath,
                        relativePath,
                        hash: createHash("sha256").update(markdown).digest("hex").slice(0, 16),
                        lastModified: stats.mtime.toISOString(),
                        headings: extractMarkdownHeadings(parsed.body),
                    });
                }
                catch (error) {
                    this.invalidSkills.push({ path: skillPath, reason: error.message });
                }
            }
        }
    }
    getSkills() {
        return [...this.skills];
    }
    getSkill(id) {
        return this.skills.find((skill) => skill.id === id);
    }
    getInvalidSkills() {
        return [...this.invalidSkills];
    }
    getRootStatus() {
        return [...this.rootStatus];
    }
}
function findSkillFiles(root) {
    const found = [];
    const pending = [root];
    while (pending.length > 0) {
        const current = pending.pop();
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const fullPath = join(current, entry.name);
            if (entry.isDirectory()) {
                pending.push(fullPath);
            }
            else if (entry.isFile() && entry.name === "SKILL.md") {
                found.push(fullPath);
            }
        }
    }
    return found.sort();
}
function normalizePath(path) {
    return path.split(sep).join("/");
}
//# sourceMappingURL=SkillRegistry.js.map