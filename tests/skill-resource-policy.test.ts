import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SkillResourcePolicy } from "../src/skills/SkillResourcePolicy.js";
import type { SkillResourceContext } from "../src/skills/types.js";

function createSkillDir() {
  const root = mkdtempSync(join(tmpdir(), "skill-resource-"));
  const skillDir = join(root, "demo");
  mkdirSync(join(skillDir, "scripts"), { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "# Demo\n[Guide](references/guide.md)");
  writeFileSync(join(skillDir, "scripts", "run.sh"), "echo ok\n");
  mkdirSync(join(skillDir, "references"));
  writeFileSync(join(skillDir, "references", "guide.md"), "# Guide\n");
  return { root, skill: createSkillContext(root, skillDir, "demo") };
}

function createSkillContext(rootPath: string, skillDir: string, relativePath: string): SkillResourceContext {
  return { rootPath, skillDir, relativePath };
}

test("readResource reads valid relative text files", () => {
  const { skill } = createSkillDir();
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  const result = policy.readResource(skill, "scripts/run.sh");

  assert.equal(result.path, "scripts/run.sh");
  assert.equal(result.content, "echo ok\n");
});

test("readResource rejects traversal and absolute paths", () => {
  const { skill } = createSkillDir();
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  assert.throws(() => policy.readResource(skill, "../secret.md"), /Resource path must not contain parent traversal/);
  assert.throws(() => policy.readResource(skill, "/tmp/secret.md"), /Resource path must be relative/);
});

test("readResource rejects arbitrary files outside local resource folders", () => {
  const { skill } = createSkillDir();
  writeFileSync(join(skill.skillDir, "notes.md"), "# Notes\n");
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  assert.throws(() => policy.readResource(skill, "notes.md"), /Resource path must be under a skill resource directory/);
});

test("readResource rejects symlink escapes", () => {
  const { root, skill } = createSkillDir();
  writeFileSync(join(root, "outside.md"), "secret");
  symlinkSync(join(root, "outside.md"), join(skill.skillDir, "references", "outside.md"));
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  assert.throws(() => policy.readResource(skill, "references/outside.md"), /approved shared roots/);
});

test("listResources returns bounded file and directory entries", () => {
  const { skill } = createSkillDir();
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 2 });

  const resources = policy.listResources(skill, "# Demo\n[Guide](references/guide.md)");

  assert.equal(resources.length, 2);
  assert.deepEqual(resources.map((entry) => entry.path).sort(), ["references", "scripts"]);
});

test("listResources exposes shared text files as skill resources", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-resource-"));
  const skillDir = join(root, "cleaner-code");
  mkdirSync(join(skillDir, "shared", "rules"), { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "# Cleaner Code\nUse shared resources when needed.\n");
  writeFileSync(join(skillDir, "shared", "rules", "style.md"), "# Style\n");
  writeFileSync(join(skillDir, "shared", "config.json"), "{}\n");
  writeFileSync(join(skillDir, "shared", "logo.png"), "not really png\n");
  const skill = createSkillContext(root, skillDir, "cleaner-code");
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  const resources = policy.listResources(skill, "# Cleaner Code\nUse shared resources when needed.\n");

  assert.deepEqual(resources.map((entry) => entry.path), [
    "shared",
    "shared/config.json",
    "shared/rules/style.md",
  ]);
});

test("listResources exposes same-skillset shared symlinks through local resource paths", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-resource-"));
  const skillDir = join(root, "cleaner-code-skillsets", "auditors", "api-design-auditor");
  const sharedDir = join(root, "cleaner-code-skillsets", "shared", "references");
  mkdirSync(join(skillDir, "references"), { recursive: true });
  mkdirSync(sharedDir, { recursive: true });
  writeFileSync(join(sharedDir, "audit-severity-rubric.md"), "# Rubric\n");
  symlinkSync(
    join(sharedDir, "audit-severity-rubric.md"),
    join(skillDir, "references", "audit-severity-rubric.md"),
  );
  const skill = createSkillContext(root, skillDir, "cleaner-code-skillsets/auditors/api-design-auditor");
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  const resources = policy.listResources(skill, "# API Auditor\n");

  assert.deepEqual(resources.map((entry) => entry.path), [
    "references",
    "references/audit-severity-rubric.md",
  ]);
});

test("readResource reads same-skillset shared symlinks through local resource paths", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-resource-"));
  const skillDir = join(root, "cleaner-code-skillsets", "auditors", "api-design-auditor");
  const sharedDir = join(root, "cleaner-code-skillsets", "shared", "references");
  mkdirSync(join(skillDir, "references"), { recursive: true });
  mkdirSync(sharedDir, { recursive: true });
  writeFileSync(join(sharedDir, "audit-severity-rubric.md"), "# Rubric\n");
  symlinkSync(
    join(sharedDir, "audit-severity-rubric.md"),
    join(skillDir, "references", "audit-severity-rubric.md"),
  );
  const skill = createSkillContext(root, skillDir, "cleaner-code-skillsets/auditors/api-design-auditor");
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  const result = policy.readResource(skill, "references/audit-severity-rubric.md");

  assert.equal(result.path, "references/audit-severity-rubric.md");
  assert.equal(result.content, "# Rubric\n");
});

test("readResource rejects direct traversal to same-skillset shared resources", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-resource-"));
  const skillDir = join(root, "cleaner-code-skillsets", "auditors", "api-design-auditor");
  const sharedDir = join(root, "cleaner-code-skillsets", "shared", "references");
  mkdirSync(skillDir, { recursive: true });
  mkdirSync(sharedDir, { recursive: true });
  writeFileSync(join(sharedDir, "audit-severity-rubric.md"), "# Rubric\n");
  const skill = createSkillContext(root, skillDir, "cleaner-code-skillsets/auditors/api-design-auditor");
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  assert.throws(
    () => policy.readResource(skill, "../../shared/references/audit-severity-rubric.md"),
    /Resource path must not contain parent traversal/,
  );
});

test("readResource rejects symlinks to sibling skill directories", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-resource-"));
  const skillDir = join(root, "cleaner-code-skillsets", "auditors", "api-design-auditor");
  const siblingDir = join(root, "cleaner-code-skillsets", "auditors", "other-auditor", "references");
  mkdirSync(join(skillDir, "references"), { recursive: true });
  mkdirSync(siblingDir, { recursive: true });
  writeFileSync(join(siblingDir, "private.md"), "# Private\n");
  symlinkSync(join(siblingDir, "private.md"), join(skillDir, "references", "private.md"));
  const skill = createSkillContext(root, skillDir, "cleaner-code-skillsets/auditors/api-design-auditor");
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  assert.throws(() => policy.readResource(skill, "references/private.md"), /approved shared roots/);
});
