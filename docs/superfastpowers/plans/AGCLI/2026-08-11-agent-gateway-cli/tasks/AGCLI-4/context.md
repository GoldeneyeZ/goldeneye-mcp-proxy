# Context for AGCLI-4

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-4`
**Commit SHA:** `14d7c79`
**Reviewed range:** `14d7c79^..14d7c79`

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
