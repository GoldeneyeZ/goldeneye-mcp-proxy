import test from "node:test";
import assert from "node:assert/strict";
import { SkillSearchEngine } from "../src/skills/SkillSearchEngine.js";

const records = [
  {
    id: "codex-deferred::review",
    name: "review",
    description: "Review pull request diffs.",
    source: "codex-deferred",
    rootPath: "/root",
    skillDir: "/root/review",
    skillPath: "/root/review/SKILL.md",
    relativePath: "review",
    hash: "abc",
    lastModified: "2026-06-13T00:00:00.000Z",
    headings: ["Code Review"],
  },
];

test("SkillSearchEngine returns compact search results", () => {
  const engine = new SkillSearchEngine();
  engine.replaceAll(records);

  const results = engine.search("pull request", 10);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "codex-deferred::review");
  assert.equal(results[0].path, "review");
  assert.ok(results[0].score > 0);
});

test("SkillSearchEngine returns all skills for empty query", () => {
  const engine = new SkillSearchEngine();
  engine.replaceAll(records);

  assert.equal(engine.search("", 10).length, 1);
});
