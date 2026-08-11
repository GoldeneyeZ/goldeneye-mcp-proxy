### Task 5: Bundle Agent Skill and Documentation

<TASK-ID>AGCLI-5</TASK-ID>

**Files:**
- Create: `skills/using-goldeneye-cli/SKILL.md`
- Create: `skills/using-goldeneye-cli/agents/openai.yaml`
- Modify: `README.md`
- Modify: `AGENT-CONTEXT.md`
- Modify: `package.json`
- Test: `tests/cli-package.test.ts`

- [ ] Run fresh-agent baseline without skill. Scenario must require search, schema discovery, invocation with a secret, async status, and `_ref` retrieval. Record at least one observed gap.
- [ ] Write package test parsing `npm pack --dry-run --json`; require both skill files.
- [ ] Run test; expect missing skill/package failure.
- [ ] Initialize with official `init_skill.py` under `skills/` and generated UI fields.
- [ ] Replace template with under-500-word `SKILL.md`: CLI-first search → describe → invoke, async polling, selective `_ref`, stdin secrets, exit codes, quick reference, one example, mistakes.
- [ ] Forward-test same scenario with skill. Require correct sequencing and safe input; fix gaps and rerun.
- [ ] Run `quick_validate.py skills/using-goldeneye-cli`; expect success.
- [ ] Add CLI docs to `README.md`, CLI-first agent rules to `AGENT-CONTEXT.md`, and `skills/` to `package.json.files`.
- [ ] Run package test, `npm run build`, `npm test`, and `npm pack --dry-run`; expect PASS and packaged skill/CLI files.
- [ ] Commit scoped files with `docs(cli): bundle agent usage skill`.
