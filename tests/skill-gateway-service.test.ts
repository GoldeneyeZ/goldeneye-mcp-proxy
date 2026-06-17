import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SkillGatewayService } from "../src/skills/SkillGatewayService.js";
import { SkillRegistry } from "../src/skills/SkillRegistry.js";
import { SkillSearchEngine } from "../src/skills/SkillSearchEngine.js";
import { SkillResourcePolicy } from "../src/skills/SkillResourcePolicy.js";

function createService() {
  const root = mkdtempSync(join(tmpdir(), "skill-service-"));
  mkdirSync(join(root, "review", "references"), { recursive: true });
  writeFileSync(join(root, "review", "SKILL.md"), `---
name: review
description: Review code changes.
---
# Review
[Guide](references/guide.md)
`);
  writeFileSync(join(root, "review", "references", "guide.md"), "# Guide\n");

  const registry = new SkillRegistry({
    sources: [{ label: "codex-deferred", path: root, enabled: true }],
    maxResourceBytes: 128 * 1024,
    maxResourceEntries: 50,
  });
  registry.refresh();
  const searchEngine = new SkillSearchEngine();
  searchEngine.replaceAll(registry.getSkills());

  return new SkillGatewayService({
    registry,
    searchEngine,
    resourcePolicy: new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 }),
    migrationPaths: {
      codexSkillsPath: join(root, ".codex", "skills"),
      deferredPath: join(root, ".codex", "skills.deferred"),
      agentsSkillsPath: join(root, ".agents", "skills"),
      agentsDeferredPath: join(root, ".agents", "skills.deferred"),
    },
  });
}

function createSharedSkillsetService() {
  const root = mkdtempSync(join(tmpdir(), "skill-service-"));
  const skillDir = join(root, "cleaner-code-skillsets", "auditors", "api-design-auditor");
  const sharedDir = join(root, "cleaner-code-skillsets", "shared", "references");
  mkdirSync(join(skillDir, "references"), { recursive: true });
  mkdirSync(sharedDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), `---
name: api-design-auditor
description: Audit API design.
---
# API Design Auditor
Use [audit severity rubric](references/audit-severity-rubric.md).
`);
  writeFileSync(join(sharedDir, "audit-severity-rubric.md"), "# Rubric\n");
  symlinkSync(
    join(sharedDir, "audit-severity-rubric.md"),
    join(skillDir, "references", "audit-severity-rubric.md"),
  );

  const registry = new SkillRegistry({
    sources: [{ label: "codex-deferred", path: root, enabled: true }],
    maxResourceBytes: 128 * 1024,
    maxResourceEntries: 50,
  });
  registry.refresh();
  const searchEngine = new SkillSearchEngine();
  searchEngine.replaceAll(registry.getSkills());

  return new SkillGatewayService({
    registry,
    searchEngine,
    resourcePolicy: new SkillResourcePolicy({ maxResourceBytes: 128 * 1024, maxResourceEntries: 50 }),
    migrationPaths: {
      codexSkillsPath: join(root, ".codex", "skills"),
      deferredPath: join(root, ".codex", "skills.deferred"),
      agentsSkillsPath: join(root, ".agents", "skills"),
      agentsDeferredPath: join(root, ".agents", "skills.deferred"),
    },
  });
}

test("search returns compact skill results", () => {
  const service = createService();

  const result = service.search({ query: "code changes", limit: 10 });

  assert.equal(result.found, 1);
  assert.equal(result.results[0].id, "codex-deferred::review");
  assert.equal(result.results[0].description, "Review code changes.");
});

test("list returns compact paginated skill metadata", () => {
  const service = createService();

  const result = service.list({ limit: 10, offset: 0 });

  assert.equal(result.count, 1);
  assert.equal(result.offset, 0);
  assert.equal(result.limit, 10);
  assert.deepEqual(result.skills, [{
    id: "codex-deferred::review",
    name: "review",
    description: "Review code changes.",
    source: "codex-deferred",
  }]);
});

test("pull returns full skill content and resource map", () => {
  const service = createService();

  const result = service.pull({ id: "codex-deferred::review" });

  assert.equal(result.name, "review");
  assert.match(result.content, /# Review/);
  assert.deepEqual(result.resources.map((entry) => entry.path), ["references", "references/guide.md"]);
});

test("readResource returns one support file", () => {
  const service = createService();

  const result = service.readResource({ id: "codex-deferred::review", path: "references/guide.md" });

  assert.equal(result.content, "# Guide\n");
});

test("pull lists same-skillset shared symlinks as local resource paths", () => {
  const service = createSharedSkillsetService();

  const result = service.pull({ id: "codex-deferred::cleaner-code-skillsets/auditors/api-design-auditor" });

  assert.deepEqual(result.resources.map((entry) => entry.path), [
    "references",
    "references/audit-severity-rubric.md",
  ]);
});

test("readResource reads same-skillset shared symlinks through local resource paths", () => {
  const service = createSharedSkillsetService();

  const result = service.readResource({
    id: "codex-deferred::cleaner-code-skillsets/auditors/api-design-auditor",
    path: "references/audit-severity-rubric.md",
  });

  assert.equal(result.path, "references/audit-severity-rubric.md");
  assert.equal(result.content, "# Rubric\n");
});

test("readResource rejects direct traversal to same-skillset shared resources", () => {
  const service = createSharedSkillsetService();

  assert.throws(
    () => service.readResource({
      id: "codex-deferred::cleaner-code-skillsets/auditors/api-design-auditor",
      path: "../../shared/references/audit-severity-rubric.md",
    }),
    /Resource path must not contain parent traversal/,
  );
});

test("pull throws for stale ids", () => {
  const service = createService();
  assert.throws(() => service.pull({ id: "missing::skill" }), /Skill not found: missing::skill/);
});

test("startup log reports deferred skill and indexed root counts", () => {
  const service = createService();
  const summary = service.refresh("startup");

  assert.equal(service.startupLogLine(), service.refreshLogLine(summary));
  assert.match(service.startupLogLine(), /Deferred skills indexed: 1 skill across 1 root/);
});

test("refresh returns summary and updates status timestamp", () => {
  const service = createService();

  const summary = service.refresh("startup");
  const status = service.status();

  assert.equal(summary.reason, "startup");
  assert.equal(summary.skillCount, 1);
  assert.equal(summary.indexedRootCount, 1);
  assert.equal(summary.invalidSkillCount, 0);
  assert.equal(summary.roots[0].indexed, true);
  assert.equal(status.lastRefreshedAt, summary.refreshedAt);
});
