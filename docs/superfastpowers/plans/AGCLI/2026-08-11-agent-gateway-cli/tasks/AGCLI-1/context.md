# Context for AGCLI-1

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-1`
**Commit SHA:** `e15f9e3`
**Reviewed range:** `e15f9e3^..e15f9e3`
**Repair commit SHA:** `2e87802`

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

## Secret-Safety Repair — 2026-08-11

### Files Changed

- `src/cli/parse-cli.ts`
- `tests/cli-parse.test.ts`
- `tests/cli-entrypoint.test.ts`

### Root Cause and Fix

- `parseOptions` interpolated uncontrolled unexpected positional and unknown-option tokens into `CliError` messages.
- Those diagnostics are now stable generic messages. Diagnostics derived from known parser constants, including `--args`, retain useful option names.

### TDD Evidence

- Parser RED: `parser diagnostics never echo unexpected argument data` failed because the message contained `Unexpected positional argument: {"password":"TOP_SECRET_7391"}`.
- Built-process RED: `built entrypoint does not echo supplied JSON in parser errors` failed because the compact error envelope contained the escaped supplied JSON and secret.
- GREEN: both regressions pass after removing uncontrolled token interpolation.

### Verification

- `node --loader ts-node/esm --test tests/cli-parse.test.ts` — PASS, 13 tests.
- Focused built parser-error tests — PASS, 2 tests.
- `node --loader ts-node/esm --test tests/cli-json-input.test.ts tests/cli-run.test.ts` — PASS, 14 tests; inline and stdin JSON remain green.
- `npm test` — PASS, 109 tests.
- `npm run build` — PASS.
- `git diff --check -- src/cli/parse-cli.ts tests/cli-parse.test.ts tests/cli-entrypoint.test.ts` — PASS.

### Remaining Plan State

- AGCLI-1 repair is implemented.
- Spec review remains failed and downstream reviews remain unchecked because AGCLI-4 top-level unknown-option validation is still outstanding.
