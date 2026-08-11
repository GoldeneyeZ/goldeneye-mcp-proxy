# Direct MCP Known-Tool Fast Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superfastpowers:goal-driven-development with `goal-driven-bypass` (recommended), `goal-driven-gated`, superfastpowers:subagent-driven-development, or superfastpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach agents to use Goldeneye MCP gateway tools directly, with no command-line workflow.

**Architecture:** Keep the renamed `using-goldeneye-mcp` skill MCP-only. Use `gateway.invoke` directly for known tools; use `gateway.search` and `gateway.describe` only for missing identity or schema knowledge.
**Plan Acronym:** GTF

**Tech Stack:** Markdown skill, Python skill validator, Node test suite

---

### Task 1: Rename Skill and Add MCP-Only Fast Path

<TASK-ID>GTF-1</TASK-ID>

**Files:**
- Rename: `skills/using-goldeneye-cli/` to `skills/using-goldeneye-mcp/`
- Modify: `skills/using-goldeneye-mcp/SKILL.md`
- Modify: `skills/using-goldeneye-mcp/agents/openai.yaml`
- Modify: `README.md`
- Test: `tests/cli-package.test.ts`
- Replace symlink: `/home/goldeneye/.agents/skills/using-goldeneye-cli` with `/home/goldeneye/.agents/skills/using-goldeneye-mcp`

- [x] **Step 1: Run failing baseline behavior test**

Run a fresh-agent scenario with the current skill: direct MCP is available; exact tool ID and current args schema are supplied; ask it to invoke the tool. Record whether it can derive direct MCP behavior from actual skill rules without contradicting the mandatory CLI workflow or inventing guidance.

Expected: FAIL—the agent either prescribes redundant CLI discovery or chooses direct MCP while citing guidance absent from the skill and contradicting its mandatory workflow.

- [x] **Step 2: Write minimal skill rule**

Rename the directory and frontmatter to `using-goldeneye-mcp`. Add this precedence rule:

```markdown
## Known-Tool Fast Path

Use `gateway.invoke` directly when either:

- the exact tool ID and current argument schema are known; or
- the tool was invoked successfully during the current session.

After a schema/input mismatch, call `gateway.describe` before retrying. Run `gateway.search` only when the exact tool ID is unknown.
```

Document only the six Goldeneye MCP gateway tools; include no command-line or shell workflow.

- [x] **Step 3: Add regression assertions**

Update package paths to `skills/using-goldeneye-mcp/`. Extend the existing package documentation test with exact semantic assertions:

```typescript
assert.match(skill, /Use `gateway\.invoke` directly/);
assert.match(skill, /exact tool ID and current argument schema are known/);
assert.match(skill, /invoked successfully during the current session/);
assert.match(skill, /Run `gateway\.search` only when the exact tool ID is unknown/);
assert.doesNotMatch(skill, /\bCLI\b|--args|goldeneye-mcp-proxy\s+(?:search|describe|invoke)/i);
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
npm test -- --test-name-pattern='agent-facing docs'
python3 /home/goldeneye/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/using-goldeneye-mcp
```

Expected: matching tests pass; validator prints `Skill is valid!`.

- [x] **Step 5: Forward-test behavior**

Repeat Step 1 using the revised skill.

Expected: PASS—the agent selects `gateway.invoke` without redundant discovery and uses only Goldeneye MCP gateway tools for uncertain cases.

- [x] **Step 6: Verify and commit**

Run:

```bash
npm test
git diff --check
```

Expected: zero failed tests; no diff errors.

```bash
git add README.md skills/using-goldeneye-cli skills/using-goldeneye-mcp tests/cli-package.test.ts
git commit -m "docs(skill): prefer direct MCP for known tools"
```

## Execution Evidence

- RED: baseline agent selected direct MCP but cited guidance absent from the old skill while contradicting its mandatory search/describe workflow; renamed-path regression then failed with `ENOENT`.
- GREEN: focused documentation test passed 1/1; official skill validator passed.
- Forward test: fresh agent selected direct MCP with no search/describe and cited the new fast-path rule.
- Full verification: tests 120/120; build passed; dry package contained both renamed skill files and no old skill path.
- MCP-only correction: RED assertion exposed command-line guidance; GREEN focused test passed; fresh agent used only `gateway.*` calls for known and unknown tool cases.
