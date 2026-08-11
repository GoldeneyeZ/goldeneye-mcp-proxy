# Context for AGCLI-1

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-1`
**Commit SHA:** `e15f9e3`
**Reviewed range:** `e15f9e3^..e15f9e3`

## Starting Context

- `src/index.ts`: current handwritten argument parsing and executable behavior.
- `src/tools/gateway-tool-schemas.ts`: exact public gateway argument schemas.
- `tests/`: Node test conventions.

## Open Context Rule

Files above are starting points only. Inspect any additional files needed to complete task correctly.

## Completion Updates

### Files Changed

- `src/cli/types.ts`
- `src/cli/parse-cli.ts`
- `src/cli/output.ts`
- `tests/cli-parse.test.ts`
- `tests/cli-output.test.ts`

### Relevant Files Inspected

- `src/index.ts`
- `src/tools/gateway-tool-schemas.ts`
- `src/transports/http/json-rpc.ts`
- `tests/schema-fields.test.ts`
- `tests/json-rpc.test.ts`
- `package.json`
- `tsconfig.json`
- Agent CLI design, implementation plan, task, and progression policy

### TDD Evidence

- Parser test first failed because `src/cli/parse-cli.ts` did not exist.
- Output test first failed because `src/cli/output.ts` did not exist.
- Empty option-value regression test then failed with `Missing expected exception (CliError)` before the minimal parser fix.

### Verification

- `node --loader ts-node/esm --test tests/cli-parse.test.ts tests/cli-output.test.ts` — PASS, 15 tests.
- `npm test` — PASS, 68 tests.
- `npm run build` — PASS.
- `git diff --check` — PASS.

### Notes

- Exactly six command names recognized; legacy flags remain outside this parser.
- Parser rejects missing, unknown, duplicate, trailing, empty-valued, and invalid numeric input with `INVALID_ARGS` / exit code 2.
- Output remains one compact JSON line; unexpected errors use a secret-safe generic `INTERNAL_ERROR` / exit code 5.
- Build-generated untracked `dist/cli/` artifacts were removed after verification; source commit contains only task-owned implementation and tests.
