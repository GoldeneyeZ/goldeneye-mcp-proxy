import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MARKER = "Global Codex skills are deferred through goldeneye-mcp-proxy.";

export interface MigrationOptions {
  dryRun: boolean;
}

export interface MigrationResult {
  changed: boolean;
  message: string;
  codexSkillsPath: string;
  deferredPath: string;
}

export class SkillMigrationService {
  private readonly codexSkillsPath: string;
  private readonly deferredPath: string;

  constructor(homeDir = homedir()) {
    this.codexSkillsPath = join(homeDir, ".codex", "skills");
    this.deferredPath = join(homeDir, ".codex", "skills.deferred");
  }

  deferCodexSkills(options: MigrationOptions): MigrationResult {
    if (!existsSync(this.codexSkillsPath)) {
      throw new Error(`Codex skills directory does not exist: ${this.codexSkillsPath}`);
    }
    if (existsSync(this.deferredPath)) {
      throw new Error(`Deferred skills directory already exists: ${this.deferredPath}`);
    }

    const message = `Would rename ${this.codexSkillsPath} to ${this.deferredPath} and create marker directory`;
    if (options.dryRun) {
      return this.result(false, message);
    }

    renameSync(this.codexSkillsPath, this.deferredPath);
    mkdirSync(this.codexSkillsPath, { recursive: true });
    writeFileSync(join(this.codexSkillsPath, "README.md"), `${MARKER}\n\nUse skills.search and skills.pull from the MCP gateway.\n`, "utf-8");
    return this.result(true, message.replace("Would rename", "Renamed"));
  }

  restoreCodexSkills(options: MigrationOptions): MigrationResult {
    if (!existsSync(this.deferredPath)) {
      throw new Error(`Deferred skills directory does not exist: ${this.deferredPath}`);
    }
    if (existsSync(this.codexSkillsPath) && !isMarkerDirectory(this.codexSkillsPath)) {
      throw new Error(`${this.codexSkillsPath} is not the migration marker directory`);
    }

    const message = `Would restore ${this.deferredPath} to ${this.codexSkillsPath}`;
    if (options.dryRun) {
      return this.result(false, message);
    }

    if (existsSync(this.codexSkillsPath)) {
      rmSync(this.codexSkillsPath, { recursive: true, force: true });
    }
    renameSync(this.deferredPath, this.codexSkillsPath);
    return this.result(true, message.replace("Would restore", "Restored"));
  }

  private result(changed: boolean, message: string): MigrationResult {
    return {
      changed,
      message,
      codexSkillsPath: this.codexSkillsPath,
      deferredPath: this.deferredPath,
    };
  }
}

function isMarkerDirectory(path: string): boolean {
  const entries = readdirSync(path);
  if (entries.length !== 1 || entries[0] !== "README.md") return false;
  return readFileSync(join(path, "README.md"), "utf-8").includes(MARKER);
}
