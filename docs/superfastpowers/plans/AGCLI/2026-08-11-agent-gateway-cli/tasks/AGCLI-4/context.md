# Context for AGCLI-4

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-4`
**Commit SHA:** `9214ece`
**Reviewed range:** `9214ece^..9214ece`

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
