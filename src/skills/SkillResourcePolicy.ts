import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { SkillResourceEntry } from "./types.js";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".sh", ".py", ".yml", ".yaml"]);

export class SkillResourcePolicy {
  constructor(private readonly limits: { maxResourceBytes: number; maxResourceEntries: number }) {}

  listResources(skillDir: string, skillMarkdown: string): SkillResourceEntry[] {
    const entries: SkillResourceEntry[] = [];
    const directNames = new Set(["scripts", "assets", "references"]);

    for (const name of directNames) {
      const path = join(skillDir, name);
      if (existsSync(path)) {
        const stats = statSync(path);
        entries.push({
          path: name,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.isFile() ? stats.size : undefined,
        });
      }
    }

    for (const linkedPath of extractMarkdownLinks(skillMarkdown)) {
      if (entries.length >= this.limits.maxResourceEntries) break;
      try {
        const fullPath = this.resolveInside(skillDir, linkedPath);
        if (!existsSync(fullPath)) continue;
        const stats = statSync(fullPath);
        entries.push({
          path: normalizePath(linkedPath),
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.isFile() ? stats.size : undefined,
        });
      } catch {
        entries.push({ path: linkedPath, type: "file", reason: "Rejected by resource policy" });
      }
    }

    return dedupe(entries).slice(0, this.limits.maxResourceEntries);
  }

  readResource(skillDir: string, resourcePath: string): { path: string; content: string; size: number } {
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

  private resolveInside(skillDir: string, resourcePath: string): string {
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
}

function extractMarkdownLinks(markdown: string): string[] {
  return Array.from(markdown.matchAll(/\[[^\]]+]\(([^)]+)\)/g))
    .map((match) => match[1])
    .filter((path) => !path.includes("://") && !path.startsWith("#"));
}

function dedupe(entries: SkillResourceEntry[]): SkillResourceEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function isTextPath(path: string): boolean {
  const dot = basename(path).lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(basename(path).slice(dot).toLowerCase());
}
