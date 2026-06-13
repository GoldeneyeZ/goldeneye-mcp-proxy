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
