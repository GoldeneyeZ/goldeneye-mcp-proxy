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
