import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { extractMarkdownHeadings, parseSkillMarkdown } from "./skill-frontmatter.js";
import type { ResolvedSkillConfig, SkillRecord } from "./types.js";

export class SkillRegistry {
  private skills: SkillRecord[] = [];
  private invalidSkills: Array<{ path: string; reason: string }> = [];
  private rootStatus: Array<{ label: string; path: string; indexed: boolean; reason?: string }> = [];

  constructor(private readonly config: ResolvedSkillConfig) {}

  refresh(): void {
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
        } catch (error) {
          this.invalidSkills.push({ path: skillPath, reason: (error as Error).message });
        }
      }
    }
  }

  getSkills(): SkillRecord[] {
    return [...this.skills];
  }

  getSkill(id: string): SkillRecord | undefined {
    return this.skills.find((skill) => skill.id === id);
  }

  getInvalidSkills(): Array<{ path: string; reason: string }> {
    return [...this.invalidSkills];
  }

  getRootStatus(): Array<{ label: string; path: string; indexed: boolean; reason?: string }> {
    return [...this.rootStatus];
  }
}

function findSkillFiles(root: string): string[] {
  const found: string[] = [];
  const pending = [root];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.pop() as string;
    const realCurrent = realpathSync(current);
    if (visited.has(realCurrent)) continue;
    visited.add(realCurrent);

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (isTraversableDirectory(entry, fullPath)) {
        pending.push(fullPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        found.push(fullPath);
      }
    }
  }

  return found.sort();
}

function isTraversableDirectory(entry: import("node:fs").Dirent, path: string): boolean {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;

  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}
