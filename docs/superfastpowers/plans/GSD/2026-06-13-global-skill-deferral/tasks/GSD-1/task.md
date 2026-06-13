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
