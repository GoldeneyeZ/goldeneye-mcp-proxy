# Context for AGCLI-4

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-4`
**Commit SHA:** `14d7c79`
**Reviewed range:** `14d7c79^..14d7c79`
**Repair commit SHA:** `a5c91fa`
**Repair reviewed range:** `a5c91fa^..a5c91fa`

## Starting Context

- `src/index.ts`: legacy dispatch to preserve and CLI dispatch point.
- `src/cli/run-cli.ts`: completed CLI entry function.
- `tests/helpers/cli-http-server.ts`: fake daemon transport.

## Open Context Rule

Files above are starting points only. Inspect any additional files needed to complete task correctly.

## Completion Updates

### Files Changed

- `src/index.ts`: dispatches recognized gateway subcommands to `runCli`, retains legacy mode parsing and branches, and documents all six commands in help.
- `tests/cli-entrypoint.test.ts`: exercises built CLI success, stable invalid-input failure, and legacy/new help content against a local fake daemon.

### Relevant Files Inspected

- `src/cli/run-cli.ts`: confirmed integrated async entrypoint and exit-code contract.
- `src/cli/parse-cli.ts`: confirmed exact six-command recognition boundary.
- `src/cli/gateway-client.ts`: confirmed fake-daemon JSON-RPC response contract.
- `tests/helpers/cli-http-server.ts`: reused shared disposable fake daemon.
- `package.json`, `tsconfig.json`: confirmed build output, binary path, Node/ESM configuration, and full-suite command.

### TDD and Verification

- RED: `npm run build && node --test tests/cli-entrypoint.test.ts` failed all three entrypoint tests because `search` entered legacy stdio and help omitted gateway commands.
- GREEN: `npm run build && node --test tests/cli-entrypoint.test.ts` passed 3/3.
- Final: `npm run build && node --test tests/cli-entrypoint.test.ts && npm test && git diff --check` exited 0; entrypoint 3/3 and full suite 100/100 passed.

### Notes

- Legacy no-argument, config-path, `--port`, `--daemon`, `--discover`, and skill-migration parsing/dispatch remain in the same precedence and branch order inside `runLegacyMode`.
- Only a recognized first token enters gateway CLI mode; malformed recognized commands therefore emit the stable CLI error envelope instead of starting stdio.
- Generated `dist/` output and unrelated pre-existing untracked files were excluded from commit `9214ece`.

## Spec-Review Repair: Built Legacy Compatibility

### Files Changed

- `tests/cli-entrypoint.test.ts`: adds built-process regression coverage for no-argument and distinct positional-config stdio startup, `--daemon`, explicit `--port`, `--discover`, and all four skill-migration modes.

### Process Isolation and Teardown

- Every legacy process uses an empty disposable config and isolated `HOME`.
- Long-running stdio/daemon children synchronize on mode-specific startup output, receive `SIGTERM`, and have a bounded `SIGKILL` fallback.
- The explicit-port test reserves a disposable loopback port; discovery and migration modes use bounded `execFile` calls.
- Skill migrations use isolated directories plus `--dry-run`, and every fixture is removed in `finally`.

### TDD and Verification

- Initial characterization: real built behavior passed, confirming the repair was coverage-only.
- Watched RED mutation: a temporary entrypoint that routed legacy tokens into `search` left the two gateway-command tests green and failed all five legacy/help process tests with exit `2` / `INVALID_ARGS`; the mutation was then removed.
- GREEN: `npm run build && node --loader ts-node/esm --test tests/cli-entrypoint.test.ts` passed 7/7.
- Full regression: `npm test` passed 105/105; `git diff --check` passed.

### Repair Notes

- Repair commit: `14d7c79` (`test(cli): cover built legacy mode dispatch`).
- Plan-scoped spec finding 2 is resolved. Findings 1 and 3 remain intentionally untouched for AGCLI-5 repair, so spec review remains failed and downstream reviews remain unchecked.
- Generated `dist/`, package lifecycle, agent documentation, review artifacts, and unrelated worktree files were excluded from this repair commit.

## Spec-Review Repair: Strict Legacy Option Validation

### Files Changed

- `src/index.ts`: validates top-level legacy options before legacy dispatch, rejects unknown `--...` tokens, and requires `--port` to have a decimal value in the TCP port range.
- `tests/cli-entrypoint.test.ts`: adds built-process regression cases for unknown options plus missing, nonnumeric, zero, and out-of-range port values; keeps child-process deadlines bounded under parallel suite load.

### TDD Evidence

- RED: built `dist/index.js --wat` timed out with exit `124`, wrote the stdio-ready marker to stdout, and emitted legacy startup logs instead of an `INVALID_ARGS` envelope.
- GREEN: focused built-process regression passed 1/1 across five invalid legacy invocations; each exited 2 with empty stdout and one compact stderr JSON line.

### Verification

- `npm run build` — PASS.
- `node --loader ts-node/esm --test tests/cli-entrypoint.test.ts` — PASS, 9/9.
- `npm test` — PASS, 110/110.
- `git diff --check -- src/index.ts tests/cli-entrypoint.test.ts` — PASS.

### Notes

- Validation happens before `runLegacyMode`, so rejected input cannot construct or start the stdio gateway.
- Documented no-argument/config-path, daemon/valid-port, discover, help, four migration, and six gateway-command paths remain green.
- Generated `dist/` and unrelated worktree files were excluded from repair commit `a5c91fa`.
