import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SkillRegistry } from "../src/skills/SkillRegistry.js";

test("SkillRegistry indexes valid SKILL.md files under configured roots", () => {
  const root = mkdtempSync(join(tmpdir(), "skills-"));
  mkdirSync(join(root, "reviews"), { recursive: true });
  writeFileSync(join(root, "reviews", "SKILL.md"), `---
name: review
description: Review code changes.
---
# Review
## Findings
`);

  const registry = new SkillRegistry({
    sources: [{ label: "codex-deferred", path: root, enabled: true }],
    maxResourceBytes: 128 * 1024,
    maxResourceEntries: 50,
  });

  registry.refresh();
  const skills = registry.getSkills();

  assert.equal(skills.length, 1);
  assert.equal(skills[0].id, "codex-deferred::reviews");
  assert.equal(skills[0].name, "review");
  assert.deepEqual(skills[0].headings, ["Review", "Findings"]);
});

test("SkillRegistry records invalid skills without failing refresh", () => {
  const root = mkdtempSync(join(tmpdir(), "skills-"));
  mkdirSync(join(root, "bad"), { recursive: true });
  writeFileSync(join(root, "bad", "SKILL.md"), "# Missing frontmatter");

  const registry = new SkillRegistry({
    sources: [{ label: "codex-deferred", path: root, enabled: true }],
    maxResourceBytes: 128 * 1024,
    maxResourceEntries: 50,
  });

  registry.refresh();

  assert.equal(registry.getSkills().length, 0);
  assert.equal(registry.getInvalidSkills().length, 1);
  assert.match(registry.getInvalidSkills()[0].reason, /Missing SKILL.md frontmatter/);
});
