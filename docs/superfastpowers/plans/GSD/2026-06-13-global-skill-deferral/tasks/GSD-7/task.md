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
