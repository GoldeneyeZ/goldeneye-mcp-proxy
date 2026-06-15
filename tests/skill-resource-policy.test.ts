import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SkillResourcePolicy } from "../src/skills/SkillResourcePolicy.js";

function createSkillDir() {
  const root = mkdtempSync(join(tmpdir(), "skill-resource-"));
  const skillDir = join(root, "demo");
  mkdirSync(join(skillDir, "scripts"), { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "# Demo\n[Guide](references/guide.md)");
  writeFileSync(join(skillDir, "scripts", "run.sh"), "echo ok\n");
  mkdirSync(join(skillDir, "references"));
  writeFileSync(join(skillDir, "references", "guide.md"), "# Guide\n");
  return { root, skillDir };
}

test("readResource reads valid relative text files", () => {
  const { skillDir } = createSkillDir();
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  const result = policy.readResource(skillDir, "scripts/run.sh");

  assert.equal(result.path, "scripts/run.sh");
  assert.equal(result.content, "echo ok\n");
});

test("readResource rejects traversal and absolute paths", () => {
  const { skillDir } = createSkillDir();
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  assert.throws(() => policy.readResource(skillDir, "../secret.md"), /Resource path must stay inside the skill directory/);
  assert.throws(() => policy.readResource(skillDir, "/tmp/secret.md"), /Resource path must be relative/);
});

test("readResource rejects symlink escapes", () => {
  const { root, skillDir } = createSkillDir();
  writeFileSync(join(root, "outside.md"), "secret");
  symlinkSync(join(root, "outside.md"), join(skillDir, "outside.md"));
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  assert.throws(() => policy.readResource(skillDir, "outside.md"), /Resource path must stay inside the skill directory/);
});

test("listResources returns bounded file and directory entries", () => {
  const { skillDir } = createSkillDir();
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 2 });

  const resources = policy.listResources(skillDir, "# Demo\n[Guide](references/guide.md)");

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
  const policy = new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 });

  const resources = policy.listResources(skillDir, "# Cleaner Code\nUse shared resources when needed.\n");

  assert.deepEqual(resources.map((entry) => entry.path), [
    "shared",
    "shared/config.json",
    "shared/rules/style.md",
  ]);
});
