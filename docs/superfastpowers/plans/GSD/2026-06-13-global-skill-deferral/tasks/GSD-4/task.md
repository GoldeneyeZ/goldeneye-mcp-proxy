### Task 4: Skill Gateway Service

<TASK-ID>GSD-4</TASK-ID>

**Files:**
- Create: `src/skills/SkillGatewayService.ts`
- Test: `tests/skill-gateway-service.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/skill-gateway-service.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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

test("pull returns full skill content and resource map", () => {
  const service = createService();

  const result = service.pull({ id: "codex-deferred::review" });

  assert.equal(result.name, "review");
  assert.match(result.content, /# Review/);
  assert.deepEqual(result.resources.map((entry) => entry.path), ["references"]);
});

test("readResource returns one support file", () => {
  const service = createService();

  const result = service.readResource({ id: "codex-deferred::review", path: "references/guide.md" });

  assert.equal(result.content, "# Guide\n");
});

test("pull throws for stale ids", () => {
  const service = createService();
  assert.throws(() => service.pull({ id: "missing::skill" }), /Skill not found: missing::skill/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/skill-gateway-service.test.ts`

Expected: FAIL with module-not-found error for `SkillGatewayService`.

- [ ] **Step 3: Implement service**

Create `src/skills/SkillGatewayService.ts`:

```ts
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
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- tests/skill-gateway-service.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/skills/SkillGatewayService.ts tests/skill-gateway-service.test.ts
git commit -m "feat(skills): add skill gateway service"
```
