# Direct MCP Known-Tool Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superfastpowers:goal-driven-development with `goal-driven-bypass` (recommended), `goal-driven-gated`, superfastpowers:subagent-driven-development, or superfastpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach agents to bypass the CLI and use direct MCP when a tool ID and current schema are already known.

**Architecture:** Add one precedence rule to the existing CLI skill. Preserve CLI discovery as fallback when direct MCP is unavailable or tool identity/schema is uncertain.
**Plan Acronym:** GTF

**Tech Stack:** Markdown skill, Python skill validator, Node test suite

---

### Task 1: Add Direct-MCP Fast Path

<TASK-ID>GTF-1</TASK-ID>

**Files:**
- Modify: `skills/using-goldeneye-cli/SKILL.md`
- Test: `tests/cli-package.test.ts`

- [ ] **Step 1: Run failing baseline behavior test**

Run a fresh-agent scenario with the current skill: direct MCP is available; exact tool ID and current args schema are supplied; ask it to invoke the tool. Record that the current required workflow still mandates CLI `search` and `describe`.

Expected: FAIL—the agent chooses or prescribes redundant CLI discovery instead of direct MCP.

- [ ] **Step 2: Write minimal skill rule**

Insert before `## Required Workflow`:

```markdown
## Direct MCP Fast Path

Use direct MCP instead of this CLI when direct MCP access is available and either:

- the exact tool ID and current argument schema are known; or
- the tool was invoked successfully during the current session.

If tool identity, schema, or freshness is uncertain, use the CLI workflow below. After a direct MCP schema/input mismatch, run `describe` before retrying. Run `search` only when the exact tool ID is unknown.
```

Change the overview's unconditional `search, describe, then invoke` sentence to identify that sequence as the fallback workflow.

- [ ] **Step 3: Add regression assertions**

Extend the existing package documentation test with exact semantic assertions:

```typescript
assert.match(skill, /Use direct MCP instead of this CLI/);
assert.match(skill, /exact tool ID and current argument schema are known/);
assert.match(skill, /invoked successfully during the current session/);
assert.match(skill, /Run `search` only when the exact tool ID is unknown/);
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- --test-name-pattern='agent-facing docs'
python3 /home/goldeneye/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/using-goldeneye-cli
```

Expected: matching tests pass; validator prints `Skill is valid!`.

- [ ] **Step 5: Forward-test behavior**

Repeat Step 1 using the revised skill.

Expected: PASS—the agent selects direct MCP without CLI `search`/`describe`; it preserves CLI fallback for uncertainty or schema mismatch.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm test
git diff --check
```

Expected: zero failed tests; no diff errors.

```bash
git add skills/using-goldeneye-cli/SKILL.md tests/cli-package.test.ts
git commit -m "docs(skill): prefer direct MCP for known tools"
```
