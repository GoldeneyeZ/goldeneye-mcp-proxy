import { existsSync, readFileSync } from "node:fs";
import type { SkillRegistry } from "./SkillRegistry.js";
import type { SkillResourcePolicy } from "./SkillResourcePolicy.js";
import type { SkillSearchEngine } from "./SkillSearchEngine.js";
import type { SkillRefreshSummary } from "./types.js";

export class SkillGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: number = -32602,
  ) {
    super(message);
  }
}

export interface SkillGatewayServiceDeps {
  registry: SkillRegistry;
  searchEngine: SkillSearchEngine;
  resourcePolicy: SkillResourcePolicy;
  migrationPaths: {
    codexSkillsPath: string;
    deferredPath: string;
    agentsSkillsPath: string;
    agentsDeferredPath: string;
  };
}

export class SkillGatewayService {
  private lastRefreshSummary?: SkillRefreshSummary;

  constructor(private readonly deps: SkillGatewayServiceDeps) {}

  list(args: { source?: string; limit?: number; offset?: number }) {
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

  search(args: { query?: string; limit?: number }) {
    const query = String(args.query || "");
    const results = this.deps.searchEngine.search(query, args.limit || 10);
    return {
      query,
      found: results.length,
      results,
    };
  }

  pull(args: { id: string }) {
    const skill = this.deps.registry.getSkill(args.id);
    if (!skill) throw new SkillGatewayError(`Skill not found: ${args.id}`);

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

  readResource(args: { id: string; path: string }) {
    const skill = this.deps.registry.getSkill(args.id);
    if (!skill) throw new SkillGatewayError(`Skill not found: ${args.id}`);
    return this.deps.resourcePolicy.readResource(skill.skillDir, args.path);
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

  startupLogLine(): string {
    const summary = this.lastRefreshSummary || this.buildRefreshSummary("startup", new Date().toISOString());
    return this.refreshLogLine(summary);
  }

  refresh(reason = "manual"): SkillRefreshSummary {
    this.deps.registry.refresh();
    this.deps.searchEngine.replaceAll(this.deps.registry.getSkills());
    this.lastRefreshSummary = this.buildRefreshSummary(reason, new Date().toISOString());
    return this.lastRefreshSummary;
  }

  refreshLogLine(summary: SkillRefreshSummary): string {
    const missingRoots = summary.roots.filter((root) => !root.indexed);
    const missingSuffix = missingRoots.length > 0
      ? `; missing roots: ${missingRoots.map((root) => `${root.label}=${root.path}`).join(", ")}`
      : "";
    return `  [skills] Deferred skills indexed: ${summary.skillCount} ${plural(summary.skillCount, "skill")} across ${summary.indexedRootCount} ${plural(summary.indexedRootCount, "root")} (${summary.reason} refresh at ${summary.refreshedAt})${missingSuffix}`;
  }

  private buildRefreshSummary(reason: string, refreshedAt: string): SkillRefreshSummary {
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

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function clampNumber(value: number | undefined, defaultValue: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
