import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { SkillResourceContext, SkillResourceEntry } from "./types.js";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".sh", ".py", ".yml", ".yaml"]);
const DIRECT_RESOURCE_NAMES = ["references", "shared", "scripts", "assets"];
const EXPANDABLE_RESOURCE_DIRS = new Set(["scripts", "references", "shared"]);
const SHARED_RESOURCE_ROOT_NAMES = ["shared", "common", "resources"];

export class SkillResourcePolicy {
  constructor(private readonly limits: { maxResourceBytes: number; maxResourceEntries: number }) {}

  listResources(skill: SkillResourceContext, skillMarkdown: string): SkillResourceEntry[] {
    const entries: SkillResourceEntry[] = [];
    const seen = new Set<string>();
    const addEntry = (entry: SkillResourceEntry): void => {
      if (entries.length >= this.limits.maxResourceEntries) return;
      const normalized = normalizePath(entry.path);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      entries.push({ ...entry, path: normalized });
    };

    for (const name of DIRECT_RESOURCE_NAMES) {
      const path = join(skill.skillDir, name);
      if (existsSync(path)) {
        try {
          const fullPath = this.resolveResource(skill, name).fullPath;
          const stats = statSync(fullPath);
          addEntry({
            path: name,
            type: stats.isDirectory() ? "directory" : "file",
            size: stats.isFile() ? stats.size : undefined,
          });
        } catch {
          addEntry({ path: name, type: "file", reason: "Rejected by resource policy" });
        }
      }
    }

    for (const name of DIRECT_RESOURCE_NAMES) {
      if (!EXPANDABLE_RESOURCE_DIRS.has(name)) continue;
      const path = join(skill.skillDir, name);
      if (!existsSync(path)) continue;
      try {
        const fullPath = this.resolveResource(skill, name).fullPath;
        if (statSync(fullPath).isDirectory()) {
          this.listTextFiles(skill, path, name, addEntry);
        }
      } catch {
        continue;
      }
    }

    for (const linkedPath of extractMarkdownLinks(skillMarkdown)) {
      if (entries.length >= this.limits.maxResourceEntries) break;
      try {
        const resolved = this.resolveResource(skill, linkedPath);
        const fullPath = resolved.fullPath;
        if (!existsSync(fullPath)) continue;
        const stats = statSync(fullPath);
        addEntry({
          path: resolved.resourcePath,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.isFile() ? stats.size : undefined,
        });
      } catch {
        addEntry({ path: linkedPath, type: "file", reason: "Rejected by resource policy" });
      }
    }

    return entries;
  }

  readResource(skill: SkillResourceContext, resourcePath: string): { path: string; content: string; size: number } {
    const resolved = this.resolveResource(skill, resourcePath);
    const fullPath = resolved.fullPath;
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
      path: resolved.resourcePath,
      content: readFileSync(fullPath, "utf-8"),
      size: stats.size,
    };
  }

  private resolveResource(skill: SkillResourceContext, resourcePath: string): { fullPath: string; resourcePath: string } {
    if (isAbsolute(resourcePath)) {
      throw new Error("Resource path must be relative");
    }

    const segments = normalizeResourceSegments(resourcePath);
    if (segments.length === 0 || !DIRECT_RESOURCE_NAMES.includes(segments[0])) {
      throw new Error("Resource path must be under a skill resource directory");
    }

    const realSkillDir = realpathSync(skill.skillDir);
    const fullPath = resolve(realSkillDir, ...segments);
    const lexicalRel = relative(realSkillDir, fullPath);
    if (lexicalRel.startsWith("..") || isAbsolute(lexicalRel)) {
      throw new Error("Resource path must stay inside the skill directory");
    }

    const realTarget = realpathSync(fullPath);
    const targetRel = relative(realSkillDir, realTarget);

    if (isInsideRelative(targetRel)) {
      return { fullPath, resourcePath: segments.join("/") };
    }

    if (!this.hasSymlinkComponent(realSkillDir, segments)) {
      throw new Error("Resource path must stay inside the skill directory");
    }

    for (const sharedRoot of sharedResourceRoots(skill)) {
      const rel = relative(sharedRoot, realTarget);
      if (isInsideRelative(rel)) {
        return { fullPath, resourcePath: segments.join("/") };
      }
    }

    throw new Error("Resource path must stay inside the skill directory or approved shared roots");
  }

  private listTextFiles(
    skill: SkillResourceContext,
    rootPath: string,
    rootResourcePath: string,
    addEntry: (entry: SkillResourceEntry) => void,
  ): void {
    const pending = [{ path: rootPath, resourcePath: rootResourcePath }];
    const visited = new Set<string>();

    while (pending.length > 0) {
      const current = pending.pop() as { path: string; resourcePath: string };
      const realCurrent = realpathSync(current.path);
      if (visited.has(realCurrent)) continue;
      visited.add(realCurrent);

      for (const entry of readdirSync(current.path, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name))) {
        const resourcePath = normalizePath(`${current.resourcePath}/${entry.name}`);
        let fullPath: string;
        let stats: ReturnType<typeof statSync>;
        try {
          fullPath = this.resolveResource(skill, resourcePath).fullPath;
          stats = statSync(fullPath);
        } catch {
          addEntry({ path: resourcePath, type: "file", reason: "Rejected by resource policy" });
          continue;
        }

        if (stats.isDirectory()) {
          pending.push({ path: fullPath, resourcePath });
        } else if (stats.isFile() && isTextPath(resourcePath)) {
          addEntry({ path: resourcePath, type: "file", size: stats.size });
        }
      }
    }
  }

  private hasSymlinkComponent(realSkillDir: string, segments: string[]): boolean {
    let current = realSkillDir;
    for (const segment of segments) {
      current = join(current, segment);
      if (lstatSync(current).isSymbolicLink()) return true;
    }
    return false;
  }
}

function extractMarkdownLinks(markdown: string): string[] {
  return Array.from(markdown.matchAll(/\[[^\]]+]\(([^)]+)\)/g))
    .map((match) => match[1])
    .filter((path) => !path.includes("://") && !path.startsWith("#"));
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function normalizeResourceSegments(path: string): string[] {
  const segments = path.split(/[\\/]+/).filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.includes("..")) {
    throw new Error("Resource path must not contain parent traversal");
  }
  return segments;
}

function isInsideRelative(path: string): boolean {
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function sharedResourceRoots(skill: SkillResourceContext): string[] {
  const skillset = skill.relativePath.split(/[\\/]+/).filter(Boolean)[0];
  if (!skillset) return [];
  const realRoot = realpathSync(skill.rootPath);
  return SHARED_RESOURCE_ROOT_NAMES
    .map((name) => join(realRoot, skillset, name))
    .filter((path) => existsSync(path))
    .map((path) => realpathSync(path));
}

function isTextPath(path: string): boolean {
  const dot = basename(path).lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(basename(path).slice(dot).toLowerCase());
}
