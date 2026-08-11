# Context for AGCLI-5

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-5`
**Commit SHA:** `fb8d1424f84b1ec3789d2dd3657fe19d6ff21c8e`
**Repair Commit SHA:** `b4e7dfb863938117a55719f5902a877d9a445aaf`

## Starting Context

- `README.md`: user documentation and install flow.
- `AGENT-CONTEXT.md`: agent-facing gateway workflow.
- `package.json`: npm published file allowlist.
- `src/cli/`: authoritative commands and output contract.

## Open Context Rule

Files above are starting points only. Inspect any additional files needed to complete task correctly.

## Completion Updates

### Files Changed

- `skills/using-goldeneye-cli/SKILL.md`
- `skills/using-goldeneye-cli/agents/openai.yaml`
- `README.md`
- `AGENT-CONTEXT.md`
- `package.json`
- `tests/cli-package.test.ts`

### Inspected Dependencies

- `src/cli/parse-cli.ts`, `src/cli/run-cli.ts`, and `src/index.ts` for authoritative command, option, mapping, endpoint, and exit behavior.
- Official `skill-creator`, `writing-skills`, and `test-driven-development` instructions.

### Skill TDD Evidence

- Baseline, fresh agent without skill: guessed obsolete `gateway.search '{...}'` syntax; invented `tool_id`, `arguments`, `invocation_id`, and `projection`; passed secret-bearing JSON through argv via command substitution.
- Forward test, fresh agent with skill: used exact `search → describe → invoke-async → invoke-status → get-result` sequence; generated secret JSON into `--args -`; used returned `jobId`; requested bounded `--fields id,name` retrieval.
- Skill initialized with official `init_skill.py`; final `SKILL.md` is 374 words.

### Verification

- Package test RED before skill: failed on missing `skills/using-goldeneye-cli/SKILL.md`.
- `node --loader ts-node/esm --test tests/cli-package.test.ts`: PASS (1/1).
- `quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`.
- `npm run build`: PASS.
- `npm test`: PASS (101/101).
- `npm pack --dry-run --json`: PASS; includes both skill files and all compiled `dist/cli/*.js` modules.
- `git diff --check`: PASS.

### Commit Range

- Implementation: `fb8d1424f84b1ec3789d2dd3657fe19d6ff21c8e`
- Spec repair: `b4e7dfb863938117a55719f5902a877d9a445aaf`
- No task-scoped reviews run (bypass policy).

## Spec Repair Evidence

### Files Changed

- `package.json`
- `tests/cli-package.test.ts`
- `AGENT-CONTEXT.md`

### Inspected Dependencies

- `src/cli/*.ts` and `src/index.ts` for compiled package modules and executable behavior.
- `src/tools/GatewayToolService.ts` and `skills/using-goldeneye-cli/SKILL.md` for the top-level `_ref`/`_truncated` contract.
- `tests/helpers/cli-http-server.ts` for packed-executable fake-daemon coverage.

### TDD and Verification

- RED: clean-source fixture `npm pack --dry-run --json` omitted `dist/index.js`; both package tests failed on the missing executable.
- GREEN: added lifecycle `prepack`; clean dry-run includes `dist/index.js`, every source-derived `dist/cli/*.js` module, and both skill files.
- Packed/extracted executable: `--help` listed all six commands; fake-daemon `search` dispatched the exact `gateway.search` JSON-RPC request and returned compact JSON.
- `node --loader ts-node/esm --test tests/cli-package.test.ts`: PASS (2/2).
- `npm run build && npm test`: PASS (106/106).
- `quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`.
- Agent-facing docs contain no `metadata.ref`; invocation example uses top-level `_ref` and `_truncated`.
- `git diff --check`: PASS.
