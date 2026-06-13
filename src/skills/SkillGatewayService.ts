import { existsSync, readFileSync } from "node:fs";
import type { SkillRegistry } from "./SkillRegistry.js";
import type { SkillResourcePolicy } from "./SkillResourcePolicy.js";
import type { SkillSearchEngine } from "./SkillSearchEngine.js";

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
  };
}

export class SkillGatewayService {
  constructor(private readonly deps: SkillGatewayServiceDeps) {}

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
      migration: {
        codexSkillsPath: this.deps.migrationPaths.codexSkillsPath,
        deferredPath: this.deps.migrationPaths.deferredPath,
        codexSkillsExists: existsSync(this.deps.migrationPaths.codexSkillsPath),
        deferredExists: existsSync(this.deps.migrationPaths.deferredPath),
      },
    };
  }

  refresh(): void {
    this.deps.registry.refresh();
    this.deps.searchEngine.replaceAll(this.deps.registry.getSkills());
  }
}
