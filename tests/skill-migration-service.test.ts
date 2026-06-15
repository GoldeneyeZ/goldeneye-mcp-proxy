import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { SkillMigrationService } from "../src/skills/SkillMigrationService.js";

test("dry-run migration reports planned rename without mutating", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-migrate-"));
  mkdirSync(join(home, ".codex", "skills"), { recursive: true });
  writeFileSync(join(home, ".codex", "skills", "README.md"), "existing");
  const service = new SkillMigrationService(home);

  const result = service.deferCodexSkills({ dryRun: true });

  assert.equal(result.changed, false);
  assert.match(result.message, /Would rename/);
  assert.equal(existsSync(join(home, ".codex", "skills")), true);
  assert.equal(existsSync(join(home, ".codex", "skills.deferred")), false);
});

test("migration renames skills and creates marker directory", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-migrate-"));
  mkdirSync(join(home, ".codex", "skills", "review"), { recursive: true });
  writeFileSync(join(home, ".codex", "skills", "review", "SKILL.md"), "skill");
  const service = new SkillMigrationService(home);

  const result = service.deferCodexSkills({ dryRun: false });

  assert.equal(result.changed, true);
  assert.equal(existsSync(join(home, ".codex", "skills.deferred", "review", "SKILL.md")), true);
  assert.match(readFileSync(join(home, ".codex", "skills", "README.md"), "utf-8"), /deferred through goldeneye-mcp-proxy/);
});

test("agents migration renames skills and creates marker directory", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-migrate-"));
  mkdirSync(join(home, ".agents", "skills", "review"), { recursive: true });
  writeFileSync(join(home, ".agents", "skills", "review", "SKILL.md"), "skill");
  const service = new SkillMigrationService(home);

  const result = service.deferAgentsSkills({ dryRun: false });

  assert.equal(result.changed, true);
  assert.equal(result.agentsSkillsPath, join(home, ".agents", "skills"));
  assert.equal(result.codexSkillsPath, undefined);
  assert.equal(existsSync(join(home, ".agents", "skills.deferred", "review", "SKILL.md")), true);
  assert.match(readFileSync(join(home, ".agents", "skills", "README.md"), "utf-8"), /deferred through goldeneye-mcp-proxy/);
});

test("agents restore refuses if marker directory was modified", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-migrate-"));
  mkdirSync(join(home, ".agents", "skills.deferred"), { recursive: true });
  mkdirSync(join(home, ".agents", "skills"), { recursive: true });
  writeFileSync(join(home, ".agents", "skills", "custom.md"), "modified");
  const service = new SkillMigrationService(home);

  assert.throws(() => service.restoreAgentsSkills({ dryRun: false }), /not the migration marker directory/);
});

test("restore refuses if marker directory was modified", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-migrate-"));
  mkdirSync(join(home, ".codex", "skills.deferred"), { recursive: true });
  mkdirSync(join(home, ".codex", "skills"), { recursive: true });
  writeFileSync(join(home, ".codex", "skills", "custom.md"), "modified");
  const service = new SkillMigrationService(home);

  assert.throws(() => service.restoreCodexSkills({ dryRun: false }), /not the migration marker directory/);
});
