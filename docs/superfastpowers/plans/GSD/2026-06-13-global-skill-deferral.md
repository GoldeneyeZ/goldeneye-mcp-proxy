# Global Skill Deferral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superfastpowers:subagent-driven-development (recommended), superfastpowers:goal-driven-development, or superfastpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate lazy skill gateway for global Codex skills, including search, pull, resource reads, status, and explicit migration from eager Codex skill loading.

**Architecture:** Add a focused `src/skills/` subsystem beside the existing MCP tool gateway. It owns skill config, discovery, indexing, resource safety, service methods, and migration, while stdio and HTTP transports only register/call `skills.*` tools through the service.
**Plan Acronym:** GSD


**Tech Stack:** TypeScript, Node.js `fs`/`path` APIs, MiniSearch, MCP SDK, Zod, `node:test`

---

## File Structure

- Create `src/skills/types.ts`: shared skill config, records, search results, resource metadata, status, and migration result types.
- Create `src/skills/skill-frontmatter.ts`: parse `SKILL.md` frontmatter and Markdown headings without adding dependencies.
- Create `src/config/skill-config.ts`: resolve `_skills` config plus default `~/.codex/skills.deferred`.
- Modify `src/shared/types.ts`: allow reserved `_skills` config without treating it as an upstream server.
- Modify `src/gateway/MCPGateway.ts`: filter `_skills` from upstream connection loops and wire skill services.
- Create `src/skills/SkillRegistry.ts`: scan global roots and produce stable skill records plus skipped reasons.
- Create `src/skills/SkillSearchEngine.ts`: MiniSearch index for compact skill search.
- Create `src/skills/SkillResourcePolicy.ts`: validate and read support files safely.
- Create `src/skills/SkillGatewayService.ts`: implement `skills.search`, `skills.pull`, `skills.read_resource`, and `skills.status`.
- Create `src/tools/skill-tool-schemas.ts`: transport-neutral schemas for `skills.*` tools.
- Modify `src/tools/stdio-tool-registration.ts`: register `skills.*` tools in stdio MCP mode.
- Modify `src/transports/http/request-router.ts`: list and call `skills.*` tools in HTTP mode.
- Modify `src/transports/http/HttpMcpServer.ts`: pass skill service into the router.
- Modify `src/index.ts`: add migration CLI flags.
- Create `src/skills/SkillMigrationService.ts`: dry-run, migrate, and restore global Codex skill directories.
- Modify `README.md`, `AGENT-CONTEXT.md`, `config.example.json`: document global skill deferral after implementation.
- Add focused tests under `tests/*.test.ts`.

---

### Task 1: Skill Types, Frontmatter, And Config

<TASK-ID>GSD-1</TASK-ID>

**Files:**
- Create: `src/skills/types.ts`
- Create: `src/skills/skill-frontmatter.ts`
- Create: `src/config/skill-config.ts`
- Modify: `src/shared/types.ts`
- Test: `tests/skill-frontmatter.test.ts`
- Test: `tests/skill-config.test.ts`

- [ ] **Step 1: Write failing frontmatter tests**

Create `tests/skill-frontmatter.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { extractMarkdownHeadings, parseSkillMarkdown } from "../src/skills/skill-frontmatter.js";

test("parseSkillMarkdown reads required yaml frontmatter fields", () => {
  const parsed = parseSkillMarkdown(`---
name: code-review
description: Review pull requests and diffs.
---

# Code Review

Body text.
`);

  assert.deepEqual(parsed.frontmatter, {
    name: "code-review",
    description: "Review pull requests and diffs.",
  });
  assert.equal(parsed.body.trim(), "# Code Review\n\nBody text.");
});

test("parseSkillMarkdown supports folded multiline descriptions", () => {
  const parsed = parseSkillMarkdown(`---
name: caveman-review
description: >
  Ultra-compressed review comments.
  Preserve actionable signal.
---
# Review
`);

  assert.equal(parsed.frontmatter.name, "caveman-review");
  assert.equal(parsed.frontmatter.description, "Ultra-compressed review comments. Preserve actionable signal.");
});

test("parseSkillMarkdown rejects missing frontmatter", () => {
  assert.throws(() => parseSkillMarkdown("# No metadata"), /Missing SKILL.md frontmatter/);
});

test("parseSkillMarkdown rejects missing required fields", () => {
  assert.throws(() => parseSkillMarkdown(`---
name: incomplete
---
Body`), /Missing required skill frontmatter field: description/);
});

test("extractMarkdownHeadings returns h1 and h2 text only", () => {
  assert.deepEqual(extractMarkdownHeadings("# Main\n\n## Setup\n\n### Detail\n\n## Usage"), ["Main", "Setup", "Usage"]);
});
```

- [ ] **Step 2: Write failing skill config tests**

Create `tests/skill-config.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { resolveSkillConfig } from "../src/config/skill-config.js";

test("resolveSkillConfig defaults to the global deferred Codex source", () => {
  const config = resolveSkillConfig({}, "/tmp/home");

  assert.deepEqual(config.sources, [{
    label: "codex-deferred",
    path: join("/tmp/home", ".codex", "skills.deferred"),
    enabled: true,
  }]);
  assert.equal(config.maxResourceBytes, 128 * 1024);
  assert.equal(config.maxResourceEntries, 50);
});

test("resolveSkillConfig appends enabled custom sources", () => {
  const config = resolveSkillConfig({
    _skills: {
      sources: [
        { label: "team", path: "/opt/team-skills" },
        { label: "off", path: "/opt/off", enabled: false },
      ],
      maxResourceBytes: 4096,
      maxResourceEntries: 12,
    },
  }, "/tmp/home");

  assert.equal(config.sources.length, 2);
  assert.equal(config.sources[1].label, "team");
  assert.equal(config.maxResourceBytes, 4096);
  assert.equal(config.maxResourceEntries, 12);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/skill-frontmatter.test.ts tests/skill-config.test.ts`

Expected: FAIL with module-not-found errors for `src/skills/skill-frontmatter.ts` and `src/config/skill-config.ts`.

- [ ] **Step 4: Add shared skill types**

Create `src/skills/types.ts`:

```ts
export interface SkillSourceConfig {
  label: string;
  path: string;
  enabled: boolean;
}

export interface SkillGatewayConfig {
  sources?: Array<{ label: string; path: string; enabled?: boolean }>;
  maxResourceBytes?: number;
  maxResourceEntries?: number;
}

export interface ResolvedSkillConfig {
  sources: SkillSourceConfig[];
  maxResourceBytes: number;
  maxResourceEntries: number;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
}

export interface ParsedSkillMarkdown {
  frontmatter: SkillFrontmatter;
  body: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  source: string;
  rootPath: string;
  skillDir: string;
  skillPath: string;
  relativePath: string;
  hash: string;
  lastModified: string;
  headings: string[];
}

export interface SkillSearchResult {
  id: string;
  name: string;
  description: string;
  source: string;
  path: string;
  hash: string;
  lastModified: string;
  score: number;
}

export interface SkillResourceEntry {
  path: string;
  type: "file" | "directory";
  size?: number;
  reason?: string;
}

export interface SkillStatus {
  roots: Array<{ label: string; path: string; indexed: boolean; reason?: string }>;
  skillCount: number;
  invalidSkillCount: number;
  invalidSkills: Array<{ path: string; reason: string }>;
  migration: {
    codexSkillsPath: string;
    deferredPath: string;
    codexSkillsExists: boolean;
    deferredExists: boolean;
  };
}
```

- [ ] **Step 5: Allow `_skills` in gateway config types**

Modify `src/shared/types.ts`:

```ts
import type { SkillGatewayConfig } from "../skills/types.js";
```

Then replace the current `GatewayConfig` interface with:

```ts
/** Top-level config: server key -> upstream config, plus reserved gateway sections */
export type GatewayConfig = {
  _skills?: SkillGatewayConfig;
} & {
  [serverKey: string]: UpstreamConfig | SkillGatewayConfig | undefined;
};

export function isUpstreamConfig(value: unknown): value is UpstreamConfig {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return type === "local" || type === "remote";
}
```

- [ ] **Step 6: Implement frontmatter parsing**

Create `src/skills/skill-frontmatter.ts`:

```ts
import type { ParsedSkillMarkdown, SkillFrontmatter } from "./types.js";

export function parseSkillMarkdown(markdown: string): ParsedSkillMarkdown {
  if (!markdown.startsWith("---\n")) {
    throw new Error("Missing SKILL.md frontmatter");
  }

  const end = markdown.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error("Unclosed SKILL.md frontmatter");
  }

  const yaml = markdown.slice(4, end);
  const body = markdown.slice(end + 4).replace(/^\r?\n/, "");
  const frontmatter = parseSimpleYaml(yaml);

  if (!frontmatter.name) throw new Error("Missing required skill frontmatter field: name");
  if (!frontmatter.description) throw new Error("Missing required skill frontmatter field: description");

  return { frontmatter, body };
}

export function extractMarkdownHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,2}\s+(.+)$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function parseSimpleYaml(yaml: string): SkillFrontmatter {
  const result: Partial<SkillFrontmatter> = {};
  const lines = yaml.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (value === ">") {
      const folded: string[] = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        folded.push(lines[++i].trim());
      }
      value = folded.join(" ").replace(/\s+/g, " ").trim();
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }

    if (key === "name" || key === "description") {
      result[key] = value;
    }
  }

  return result as SkillFrontmatter;
}
```

- [ ] **Step 7: Implement skill config resolution**

Create `src/config/skill-config.ts`:

```ts
import { homedir } from "node:os";
import { join } from "node:path";
import type { GatewayConfig } from "../shared/types.js";
import type { ResolvedSkillConfig, SkillGatewayConfig, SkillSourceConfig } from "../skills/types.js";

export const DEFAULT_MAX_RESOURCE_BYTES = 128 * 1024;
export const DEFAULT_MAX_RESOURCE_ENTRIES = 50;

export function resolveSkillConfig(config: GatewayConfig, homeDir = homedir()): ResolvedSkillConfig {
  const raw = (config._skills || {}) as SkillGatewayConfig;
  const defaultSource: SkillSourceConfig = {
    label: "codex-deferred",
    path: join(homeDir, ".codex", "skills.deferred"),
    enabled: true,
  };

  const customSources = (raw.sources || [])
    .map((source) => ({
      label: source.label,
      path: source.path,
      enabled: source.enabled !== false,
    }))
    .filter((source) => source.enabled);

  return {
    sources: [defaultSource, ...customSources],
    maxResourceBytes: raw.maxResourceBytes || DEFAULT_MAX_RESOURCE_BYTES,
    maxResourceEntries: raw.maxResourceEntries || DEFAULT_MAX_RESOURCE_ENTRIES,
  };
}
```

- [ ] **Step 8: Run tests and build**

Run: `npm test -- tests/skill-frontmatter.test.ts tests/skill-config.test.ts`

Expected: PASS for both new test files.

Run: `npm run build`

Expected: PASS. If `GatewayConfig` type changes reveal compile errors in existing files, update those files by narrowing with `isUpstreamConfig` before treating config entries as upstream servers.

- [ ] **Step 9: Commit**

```bash
git add src/skills/types.ts src/skills/skill-frontmatter.ts src/config/skill-config.ts src/shared/types.ts tests/skill-frontmatter.test.ts tests/skill-config.test.ts
git commit -m "feat(skills): add skill config parsing"
```

---

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

---

### Task 3: Resource Policy And Resource Maps

<TASK-ID>GSD-3</TASK-ID>

**Files:**
- Create: `src/skills/SkillResourcePolicy.ts`
- Test: `tests/skill-resource-policy.test.ts`

- [ ] **Step 1: Write failing resource policy tests**

Create `tests/skill-resource-policy.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/skill-resource-policy.test.ts`

Expected: FAIL with module-not-found error for `SkillResourcePolicy`.

- [ ] **Step 3: Implement `SkillResourcePolicy`**

Create `src/skills/SkillResourcePolicy.ts`:

```ts
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import type { SkillResourceEntry } from "./types.js";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".sh", ".py", ".yml", ".yaml"]);

export class SkillResourcePolicy {
  constructor(private readonly limits: { maxResourceBytes: number; maxResourceEntries: number }) {}

  listResources(skillDir: string, skillMarkdown: string): SkillResourceEntry[] {
    const entries: SkillResourceEntry[] = [];
    const directNames = new Set(["scripts", "assets", "references"]);

    for (const name of directNames) {
      const path = join(skillDir, name);
      if (existsSync(path)) {
        const stats = statSync(path);
        entries.push({
          path: name,
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.isFile() ? stats.size : undefined,
        });
      }
    }

    for (const linkedPath of extractMarkdownLinks(skillMarkdown)) {
      if (entries.length >= this.limits.maxResourceEntries) break;
      try {
        const fullPath = this.resolveInside(skillDir, linkedPath);
        if (!existsSync(fullPath)) continue;
        const stats = statSync(fullPath);
        entries.push({
          path: normalizePath(linkedPath),
          type: stats.isDirectory() ? "directory" : "file",
          size: stats.isFile() ? stats.size : undefined,
        });
      } catch {
        entries.push({ path: linkedPath, type: "file", reason: "Rejected by resource policy" });
      }
    }

    return dedupe(entries).slice(0, this.limits.maxResourceEntries);
  }

  readResource(skillDir: string, resourcePath: string): { path: string; content: string; size: number } {
    const fullPath = this.resolveInside(skillDir, resourcePath);
    const stats = statSync(fullPath);
    if (!stats.isFile()) {
      throw new Error(`Resource is not a file: ${resourcePath}`);
    }
    if (stats.size > this.limits.maxResourceBytes) {
      throw new Error(`Resource exceeds max size of ${this.limits.maxResourceBytes} bytes: ${resourcePath}`);
    }
    if (!isTextPath(resourcePath)) {
      throw new Error(`Unsupported resource file type: ${resourcePath}`);
    }

    return {
      path: normalizePath(resourcePath),
      content: readFileSync(fullPath, "utf-8"),
      size: stats.size,
    };
  }

  private resolveInside(skillDir: string, resourcePath: string): string {
    if (isAbsolute(resourcePath)) {
      throw new Error("Resource path must be relative");
    }

    const fullPath = join(skillDir, resourcePath);
    const realSkillDir = realpathSync(skillDir);
    const realTarget = realpathSync(fullPath);
    const rel = relative(realSkillDir, realTarget);

    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error("Resource path must stay inside the skill directory");
    }
    if (lstatSync(fullPath).isSymbolicLink()) {
      const symlinkRel = relative(realSkillDir, realTarget);
      if (symlinkRel.startsWith("..") || isAbsolute(symlinkRel)) {
        throw new Error("Resource path must stay inside the skill directory");
      }
    }

    return fullPath;
  }
}

function extractMarkdownLinks(markdown: string): string[] {
  return Array.from(markdown.matchAll(/\[[^\]]+]\(([^)]+)\)/g))
    .map((match) => match[1])
    .filter((path) => !path.includes("://") && !path.startsWith("#"));
}

function dedupe(entries: SkillResourceEntry[]): SkillResourceEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function isTextPath(path: string): boolean {
  const dot = basename(path).lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(basename(path).slice(dot).toLowerCase());
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- tests/skill-resource-policy.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/skills/SkillResourcePolicy.ts tests/skill-resource-policy.test.ts
git commit -m "feat(skills): guard resource reads"
```

---

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

---

### Task 5: Register Skills Tools In Stdio And HTTP

<TASK-ID>GSD-5</TASK-ID>

**Files:**
- Create: `src/tools/skill-tool-schemas.ts`
- Modify: `src/tools/stdio-tool-registration.ts`
- Modify: `src/transports/http/request-router.ts`
- Modify: `src/transports/http/HttpMcpServer.ts`
- Modify: `src/gateway/MCPGateway.ts`
- Test: `tests/skill-tools-router.test.ts`

- [ ] **Step 1: Write failing HTTP router tests**

Create `tests/skill-tools-router.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { HttpMcpRequestRouter } from "../src/transports/http/request-router.js";

const gatewayService = {
  search: () => ({ found: 0, results: [] }),
  describe: () => ({}),
  invoke: async () => ({}),
  invokeAsync: () => ({}),
  invokeStatus: () => ({}),
  getResult: () => ({}),
};

const skillService = {
  search: () => ({ query: "review", found: 1, results: [{ id: "codex-deferred::review" }] }),
  pull: () => ({ id: "codex-deferred::review", content: "# Review", resources: [] }),
  readResource: () => ({ path: "references/guide.md", content: "# Guide\n", size: 8 }),
  status: () => ({ skillCount: 1 }),
};

test("tools/list includes skills tools separately from gateway tools", async () => {
  const router = new HttpMcpRequestRouter(gatewayService as never, skillService as never);

  const response = await router.route({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const names = (response?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);

  assert.ok(names.includes("gateway.search"));
  assert.ok(names.includes("skills.search"));
  assert.ok(names.includes("skills.pull"));
  assert.ok(names.includes("skills.read_resource"));
  assert.ok(names.includes("skills.status"));
});

test("tools/call routes skills.search", async () => {
  const router = new HttpMcpRequestRouter(gatewayService as never, skillService as never);

  const response = await router.route({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "skills.search", arguments: { query: "review" } },
  });

  const content = (response?.result as { content: Array<{ text: string }> }).content[0].text;
  assert.match(content, /codex-deferred::review/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/skill-tools-router.test.ts`

Expected: FAIL because `HttpMcpRequestRouter` does not accept a skill service and does not list `skills.*` tools.

- [ ] **Step 3: Add skill tool schemas**

Create `src/tools/skill-tool-schemas.ts`:

```ts
import type { ToolSchema } from "./gateway-tool-schemas.js";

export const SKILL_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "skills.search",
    description: "Search global deferred skills. Returns compact metadata only, never full SKILL.md content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results to return (default 10, max 50)" },
      },
    },
  },
  {
    name: "skills.pull",
    description: "Return one full SKILL.md by id, plus metadata and a bounded resource map.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID from skills.search" },
      },
      required: ["id"],
    },
  },
  {
    name: "skills.read_resource",
    description: "Read one support file for a pulled skill by relative path.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID from skills.search" },
        path: { type: "string", description: "Relative resource path from skills.pull resources" },
      },
      required: ["id", "path"],
    },
  },
  {
    name: "skills.status",
    description: "Report indexed skill roots, skill counts, invalid skills, and Codex skill migration status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];
```

- [ ] **Step 4: Wire skill services in `MCPGateway`**

Modify `src/gateway/MCPGateway.ts` imports:

```ts
import { resolveSkillConfig } from "../config/skill-config.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";
import { SkillSearchEngine } from "../skills/SkillSearchEngine.js";
import { SkillResourcePolicy } from "../skills/SkillResourcePolicy.js";
import { SkillGatewayService } from "../skills/SkillGatewayService.js";
import { isUpstreamConfig } from "../shared/types.js";
import { homedir } from "node:os";
import { join } from "node:path";
```

Add fields:

```ts
private skillRegistry: SkillRegistry;
private skillSearchEngine: SkillSearchEngine;
private skillResourcePolicy: SkillResourcePolicy;
private skillService: SkillGatewayService;
```

Initialize after `this.toolService` setup:

```ts
const skillConfig = resolveSkillConfig(this.config.getAll());
this.skillRegistry = new SkillRegistry(skillConfig);
this.skillSearchEngine = new SkillSearchEngine();
this.skillResourcePolicy = new SkillResourcePolicy({
  maxResourceBytes: skillConfig.maxResourceBytes,
  maxResourceEntries: skillConfig.maxResourceEntries,
});
this.skillService = new SkillGatewayService({
  registry: this.skillRegistry,
  searchEngine: this.skillSearchEngine,
  resourcePolicy: this.skillResourcePolicy,
  migrationPaths: {
    codexSkillsPath: join(homedir(), ".codex", "skills"),
    deferredPath: join(homedir(), ".codex", "skills.deferred"),
  },
});
this.skillService.refresh();
```

Pass it to `createServer`:

```ts
this.server = createServer(this.toolService, statusHolder, this.skillService);
```

In `connectAll`, skip reserved config entries:

```ts
for (const [serverKey, config] of Object.entries(allConfig)) {
  if (!isUpstreamConfig(config)) continue;
  if (config.enabled === false) continue;
  // existing lazy/eager logic
}
```

In `handleConfigChange`, compute key sets from upstream-only entries and refresh skills before completing reload:

```ts
const oldKeys = new Set(Object.entries(oldConfig).filter(([, value]) => isUpstreamConfig(value)).map(([key]) => key));
const newKeys = new Set(Object.entries(newConfig).filter(([, value]) => isUpstreamConfig(value)).map(([key]) => key));
```

Add before `this.searchEngine.warmup()` in the debounce:

```ts
this.skillService.refresh();
```

Add to `getSharedServices()`:

```ts
skillService: this.skillService,
```

- [ ] **Step 5: Register stdio skill tools**

Modify `src/tools/stdio-tool-registration.ts` imports:

```ts
import type { SkillGatewayService } from "../skills/SkillGatewayService.js";
```

Change signature:

```ts
export function createServer(
  toolService: GatewayToolService,
  statusHolder?: StatusHolder,
  skillService?: SkillGatewayService,
): McpServer {
```

Before status registration:

```ts
if (skillService) registerSkillTools(server, skillService);
```

Add helper:

```ts
function registerSkillTools(server: McpServer, skillService: SkillGatewayService): void {
  server.registerTool(
    "skills.search",
    {
      title: "Search Deferred Skills",
      description: "Search global deferred skills. Returns compact metadata only.",
      inputSchema: {
        query: z.string().optional().describe("Search query"),
        limit: z.number().optional().describe("Max results to return"),
      },
    },
    async ({ query, limit }) => runTool(() => skillService.search({ query, limit })),
  );

  server.registerTool(
    "skills.pull",
    {
      title: "Pull Deferred Skill",
      description: "Return one full SKILL.md plus metadata and resource map.",
      inputSchema: {
        id: z.string().describe("Skill ID from skills.search"),
      },
    },
    async ({ id }) => runTool(() => skillService.pull({ id })),
  );

  server.registerTool(
    "skills.read_resource",
    {
      title: "Read Skill Resource",
      description: "Read one support file from a deferred skill.",
      inputSchema: {
        id: z.string().describe("Skill ID from skills.search"),
        path: z.string().describe("Relative resource path"),
      },
    },
    async ({ id, path }) => runTool(() => skillService.readResource({ id, path })),
  );

  server.registerTool(
    "skills.status",
    {
      title: "Get Skill Gateway Status",
      description: "Report indexed skill roots, invalid skills, and migration status.",
      inputSchema: {},
    },
    async () => runTool(() => skillService.status()),
  );
}
```

- [ ] **Step 6: Register HTTP skill tools**

Modify `src/transports/http/request-router.ts` imports:

```ts
import type { SkillGatewayService } from "../../skills/SkillGatewayService.js";
import { SkillGatewayError } from "../../skills/SkillGatewayService.js";
import { SKILL_TOOL_SCHEMAS } from "../../tools/skill-tool-schemas.js";
```

Change constructor:

```ts
constructor(
  private readonly toolService: GatewayToolService,
  private readonly skillService?: SkillGatewayService,
) {}
```

In `handleToolsList`, concatenate schemas:

```ts
const tools = this.skillService ? [...GATEWAY_TOOL_SCHEMAS, ...SKILL_TOOL_SCHEMAS] : GATEWAY_TOOL_SCHEMAS;
return jsonRpcSuccess(id, {
  tools: tools.map((tool) => ({
    name: tool.name,
    title: tool.name.includes(".") ? tool.name.split(".")[1] : tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
});
```

Add cases in `handleToolsCall`:

```ts
case "skills.search":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.search({
    query: String(args.query || ""),
    limit: Number(args.limit) || 10,
  })));
case "skills.pull":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.pull({ id: String(args.id || "") })));
case "skills.read_resource":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.readResource({
    id: String(args.id || ""),
    path: String(args.path || ""),
  })));
case "skills.status":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.status()));
```

In the catch block, handle `SkillGatewayError` like `GatewayToolError`:

```ts
if (error instanceof GatewayToolError || error instanceof SkillGatewayError) {
  return jsonRpcError(id, error.code, error.message);
}
```

Modify `src/transports/http/HttpMcpServer.ts` constructor:

```ts
import type { SkillGatewayService } from "../../skills/SkillGatewayService.js";
```

```ts
constructor(
  private readonly searchEngine: SearchEngine,
  private readonly connections: ConnectionManager,
  toolService: GatewayToolService,
  port?: number,
  skillService?: SkillGatewayService,
) {
  this.port = port || 8767;
  this.router = new HttpMcpRequestRouter(toolService, skillService);
}
```

Modify `src/index.ts` daemon construction:

```ts
const httpServer = new HttpMcpServer(
  services.searchEngine,
  services.connections,
  services.toolService,
  daemonPort,
  services.skillService,
);
```

- [ ] **Step 7: Run router tests, full tests, and build**

Run: `npm test -- tests/skill-tools-router.test.ts`

Expected: PASS.

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tools/skill-tool-schemas.ts src/tools/stdio-tool-registration.ts src/transports/http/request-router.ts src/transports/http/HttpMcpServer.ts src/gateway/MCPGateway.ts tests/skill-tools-router.test.ts
git commit -m "feat(skills): expose skill gateway tools"
```

---

### Task 6: Codex Skill Migration CLI

<TASK-ID>GSD-6</TASK-ID>

**Files:**
- Create: `src/skills/SkillMigrationService.ts`
- Modify: `src/index.ts`
- Test: `tests/skill-migration-service.test.ts`

- [ ] **Step 1: Write failing migration tests**

Create `tests/skill-migration-service.test.ts`:

```ts
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

test("restore refuses if marker directory was modified", () => {
  const home = mkdtempSync(join(tmpdir(), "skill-migrate-"));
  mkdirSync(join(home, ".codex", "skills.deferred"), { recursive: true });
  mkdirSync(join(home, ".codex", "skills"), { recursive: true });
  writeFileSync(join(home, ".codex", "skills", "custom.md"), "modified");
  const service = new SkillMigrationService(home);

  assert.throws(() => service.restoreCodexSkills({ dryRun: false }), /not the migration marker directory/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/skill-migration-service.test.ts`

Expected: FAIL with module-not-found error for `SkillMigrationService`.

- [ ] **Step 3: Implement migration service**

Create `src/skills/SkillMigrationService.ts`:

```ts
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
```

- [ ] **Step 4: Add CLI flags**

Modify `src/index.ts` imports:

```ts
import { SkillMigrationService } from "./skills/SkillMigrationService.js";
```

Add flags near CLI parsing:

```ts
let deferCodexSkills = false;
let restoreCodexSkills = false;
let dryRun = false;
```

Add parse cases:

```ts
} else if (args[i] === "--defer-codex-skills") {
  deferCodexSkills = true;
} else if (args[i] === "--restore-codex-skills") {
  restoreCodexSkills = true;
} else if (args[i] === "--dry-run") {
  dryRun = true;
```

Add branch before discovery/daemon/stdin:

```ts
} else if (deferCodexSkills || restoreCodexSkills) {
  runSkillMigration(deferCodexSkills, restoreCodexSkills, dryRun);
```

Add function:

```ts
function runSkillMigration(deferCodexSkills: boolean, restoreCodexSkills: boolean, dryRun: boolean): void {
  if (deferCodexSkills && restoreCodexSkills) {
    console.error("Use only one of --defer-codex-skills or --restore-codex-skills");
    process.exit(1);
  }

  const service = new SkillMigrationService();
  try {
    const result = deferCodexSkills
      ? service.deferCodexSkills({ dryRun })
      : service.restoreCodexSkills({ dryRun });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
```

Update usage text with:

```text
  goldeneye-mcp-proxy --defer-codex-skills [--dry-run]
  goldeneye-mcp-proxy --restore-codex-skills [--dry-run]
```

- [ ] **Step 5: Run tests and build**

Run: `npm test -- tests/skill-migration-service.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/skills/SkillMigrationService.ts src/index.ts tests/skill-migration-service.test.ts
git commit -m "feat(skills): add Codex skill migration"
```

---

### Task 7: Documentation And Example Config

<TASK-ID>GSD-7</TASK-ID>

**Files:**
- Modify: `README.md`
- Modify: `AGENT-CONTEXT.md`
- Modify: `config.example.json`

- [ ] **Step 1: Update config example**

Add this reserved section near the top of `config.example.json`, after `_note`:

```json
  "_skills": {
    "sources": [
      {
        "label": "team",
        "path": "/path/to/global/team-skills",
        "enabled": false
      }
    ],
    "maxResourceBytes": 131072,
    "maxResourceEntries": 50
  },
```

Keep the existing server examples unchanged.

- [ ] **Step 2: Update README tool count and feature summary**

In `README.md`, change startup wording from "6 tool definitions" to "gateway tool definitions" and add a fifth feature under "What it does":

```md
5. **Global skill deferral** — Global Codex skills can be moved from
   `~/.codex/skills` to `~/.codex/skills.deferred` and exposed through
   `skills.search`, `skills.pull`, and `skills.read_resource`. Skill bodies and
   support files are loaded only when the agent asks for them.
```

Add a table section after "The 6 Gateway Tools":

```md
## Skill Gateway Tools

| Tool | Purpose |
|------|---------|
| `skills.search` | Search global deferred skills by name, description, source, path, and headings |
| `skills.pull` | Load one full `SKILL.md` plus metadata and a bounded resource map |
| `skills.read_resource` | Read one support file for a pulled skill |
| `skills.status` | Inspect indexed skill roots, invalid skills, and Codex migration state |
```

Add a migration section:

````md
## Deferring Global Codex Skills

Run a dry-run first:

```bash
goldeneye-mcp-proxy --defer-codex-skills --dry-run
```

Then migrate:

```bash
goldeneye-mcp-proxy --defer-codex-skills
```

This renames `~/.codex/skills` to `~/.codex/skills.deferred` and leaves a marker
README in `~/.codex/skills`, so Codex stops eagerly loading those global skills.
Rollback is available with:

```bash
goldeneye-mcp-proxy --restore-codex-skills
```
````

- [ ] **Step 3: Update agent context**

Add to `AGENT-CONTEXT.md` after the gateway workflow section:

```md
## Lazy Global Skills

When you need specialized instructions, search the skill gateway first instead of
assuming every skill is already in context.

1. `skills.search({ query: "code review" })`
2. `skills.pull({ id: "codex-deferred::caveman/caveman-review" })`
3. `skills.read_resource({ id, path })` only when the pulled skill references a
   specific support file you need.

Do not call `skills.read_resource` for every listed resource. Pull only the files
that the selected skill says are relevant to the current task.
```

- [ ] **Step 4: Run docs validation and build**

Run: `node -e "JSON.parse(require('fs').readFileSync('config.example.json','utf8')); console.log('config ok')"`

Expected: prints `config ok`.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENT-CONTEXT.md config.example.json
git commit -m "docs: document global skill deferral"
```

---

### Task 8: Final Verification

<TASK-ID>GSD-8</TASK-ID>

**Files:**
- Modify only if verification exposes a real issue.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: PASS for all `tests/**/*.test.ts`.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS and updated `dist/` files are generated.

- [ ] **Step 3: Verify HTTP tool listing includes both gateways**

Run this one-off command after build:

```bash
node -e "import('./dist/transports/http/request-router.js').then(async ({HttpMcpRequestRouter}) => { const gateway={search:()=>({}),describe:()=>({}),invoke:async()=>({}),invokeAsync:()=>({}),invokeStatus:()=>({}),getResult:()=>({})}; const skills={search:()=>({}),pull:()=>({}),readResource:()=>({}),status:()=>({})}; const r=new HttpMcpRequestRouter(gateway, skills); const res=await r.route({jsonrpc:'2.0',id:1,method:'tools/list'}); const names=res.result.tools.map(t=>t.name); console.log(names.filter(n=>n.startsWith('skills.')).join(',')); })"
```

Expected output contains:

```text
skills.search,skills.pull,skills.read_resource,skills.status
```

- [ ] **Step 4: Review git status**

Run: `git status --short`

Expected: only intended source, test, docs, and generated `dist/` files are modified. Existing unrelated user changes, such as a pre-existing modified `README.md` or untracked exploratory tests, must not be reverted.

- [ ] **Step 5: Commit build artifacts if this repo tracks `dist/`**

If `npm run build` modified `dist/`, commit those generated files:

```bash
git add dist
git commit -m "build: update generated skill gateway output"
```

If `dist/` did not change, skip this commit.
