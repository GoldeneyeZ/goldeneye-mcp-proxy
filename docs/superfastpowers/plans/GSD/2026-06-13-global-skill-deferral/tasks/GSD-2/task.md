### Task 2: Skill Registry And Search Engine

<TASK-ID>GSD-2</TASK-ID>

**Files:**
- Create: `src/skills/SkillRegistry.ts`
- Create: `src/skills/SkillSearchEngine.ts`
- Test: `tests/skill-registry.test.ts`
- Test: `tests/skill-search-engine.test.ts`

- [ ] **Step 1: Write failing registry tests**

Create `tests/skill-registry.test.ts`:

```ts
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
```

- [ ] **Step 2: Write failing search tests**

Create `tests/skill-search-engine.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { SkillSearchEngine } from "../src/skills/SkillSearchEngine.js";
import type { SkillRecord } from "../src/skills/types.js";

const records: SkillRecord[] = [
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/skill-registry.test.ts tests/skill-search-engine.test.ts`

Expected: FAIL with module-not-found errors for `SkillRegistry` and `SkillSearchEngine`.

- [ ] **Step 4: Implement `SkillRegistry`**

Create `src/skills/SkillRegistry.ts`:

```ts
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ResolvedSkillConfig, SkillRecord } from "./types.js";
import { extractMarkdownHeadings, parseSkillMarkdown } from "./skill-frontmatter.js";

export class SkillRegistry {
  private skills: SkillRecord[] = [];
  private invalidSkills: Array<{ path: string; reason: string }> = [];
  private rootStatus: Array<{ label: string; path: string; indexed: boolean; reason?: string }> = [];

  constructor(private readonly config: ResolvedSkillConfig) {}

  refresh(): void {
    this.skills = [];
    this.invalidSkills = [];
    this.rootStatus = [];

    for (const source of this.config.sources) {
      if (!existsSync(source.path)) {
        this.rootStatus.push({ label: source.label, path: source.path, indexed: false, reason: "Root does not exist" });
        continue;
      }

      this.rootStatus.push({ label: source.label, path: source.path, indexed: true });
      for (const skillPath of findSkillFiles(source.path)) {
        try {
          const markdown = readFileSync(skillPath, "utf-8");
          const parsed = parseSkillMarkdown(markdown);
          const stats = statSync(skillPath);
          const skillDir = skillPath.replace(/[/\\]SKILL\.md$/, "");
          const relativePath = normalizePath(relative(source.path, skillDir));
          this.skills.push({
            id: `${source.label}::${relativePath}`,
            name: parsed.frontmatter.name,
            description: parsed.frontmatter.description,
            source: source.label,
            rootPath: source.path,
            skillDir,
            skillPath,
            relativePath,
            hash: createHash("sha256").update(markdown).digest("hex").slice(0, 16),
            lastModified: stats.mtime.toISOString(),
            headings: extractMarkdownHeadings(parsed.body),
          });
        } catch (error) {
          this.invalidSkills.push({ path: skillPath, reason: (error as Error).message });
        }
      }
    }
  }

  getSkills(): SkillRecord[] {
    return [...this.skills];
  }

  getSkill(id: string): SkillRecord | undefined {
    return this.skills.find((skill) => skill.id === id);
  }

  getInvalidSkills(): Array<{ path: string; reason: string }> {
    return [...this.invalidSkills];
  }

  getRootStatus(): Array<{ label: string; path: string; indexed: boolean; reason?: string }> {
    return [...this.rootStatus];
  }
}

function findSkillFiles(root: string): string[] {
  const found: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        found.push(fullPath);
      }
    }
  }

  return found.sort();
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}
```

- [ ] **Step 5: Implement `SkillSearchEngine`**

Create `src/skills/SkillSearchEngine.ts`:

```ts
import MiniSearch from "minisearch";
import type { SkillRecord, SkillSearchResult } from "./types.js";

interface SkillSearchDocument extends SkillRecord {
  headingText: string;
}

export class SkillSearchEngine {
  private records = new Map<string, SkillRecord>();
  private miniSearch: MiniSearch<SkillSearchDocument> | null = null;

  replaceAll(records: SkillRecord[]): void {
    this.records = new Map(records.map((record) => [record.id, record]));

    if (records.length === 0) {
      this.miniSearch = null;
      return;
    }

    this.miniSearch = new MiniSearch<SkillSearchDocument>({
      fields: ["name", "description", "source", "relativePath", "headingText"],
      storeFields: ["id", "name", "description", "source", "relativePath", "hash", "lastModified"],
      searchOptions: {
        boost: { name: 3, description: 2, headingText: 1.5 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: "OR",
      },
    });

    this.miniSearch.addAll(records.map((record) => ({
      ...record,
      headingText: record.headings.join(" "),
    })));
  }

  search(query: string, limit = 10): SkillSearchResult[] {
    const maxLimit = Math.min(limit, 50);

    if (!query.trim()) {
      return Array.from(this.records.values()).slice(0, maxLimit).map((record) => toResult(record, 0));
    }

    if (!this.miniSearch) return [];

    return this.miniSearch.search(query.toLowerCase())
      .slice(0, maxLimit)
      .map((result) => {
        const record = this.records.get(result.id as string);
        return record ? toResult(record, result.score || 0) : undefined;
      })
      .filter((result): result is SkillSearchResult => Boolean(result));
  }
}

function toResult(record: SkillRecord, score: number): SkillSearchResult {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    source: record.source,
    path: record.relativePath,
    hash: record.hash,
    lastModified: record.lastModified,
    score: Math.round(score * 100) / 100,
  };
}
```

- [ ] **Step 6: Run tests and build**

Run: `npm test -- tests/skill-registry.test.ts tests/skill-search-engine.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/skills/SkillRegistry.ts src/skills/SkillSearchEngine.ts tests/skill-registry.test.ts tests/skill-search-engine.test.ts
git commit -m "feat(skills): index deferred skills"
```
