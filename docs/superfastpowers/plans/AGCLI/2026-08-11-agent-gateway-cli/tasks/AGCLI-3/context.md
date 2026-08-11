# Context for AGCLI-3

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-3`
**Commit SHA:** `ed45ea0`
**Reviewed range:** `ed45ea0^..ed45ea0`

## Starting Context

- `goldeneye-mcp-proxy.service`: deployed user service name and daemon command.
- `src/cli/gateway-client.ts`: connection error boundary from AGCLI-2.
- `src/index.ts`: current executable path and daemon flag.

## Open Context Rule

Files above are starting points only. Inspect any additional files needed to complete task correctly.

## Completion Updates

### Files Changed

- `src/cli/daemon-startup.ts`
- `src/cli/run-cli.ts`
- `tests/cli-daemon-startup.test.ts`
- `tests/cli-run.test.ts`

### Relevant Files Inspected

- `src/cli/types.ts`
- `src/cli/parse-cli.ts`
- `src/cli/json-input.ts`
- `src/cli/gateway-client.ts`
- `src/cli/output.ts`
- `src/index.ts`
- `src/tools/GatewayToolService.ts`
- `src/tools/gateway-tool-schemas.ts`
- `src/transports/http/HttpMcpServer.ts`
- `src/transports/http/request-router.ts`
- `goldeneye.service`
- `package.json`
- `tsconfig.json`
- Agent CLI design, implementation plan, task, and progression policy

### TDD Evidence

- Daemon-startup and runner suites first failed because both production modules were missing.
- After minimal implementations, both focused suites passed with 12 tests.

### Verification

- `node --loader ts-node/esm --test tests/cli-daemon-startup.test.ts tests/cli-run.test.ts` — PASS, 12 tests.
- `npm run build` — PASS.
- `npm test` — PASS, 97 tests.
- `git diff --cached --check` — PASS before implementation commit.

### Notes

- Recovery derives `/health`, probes before process startup, tries the user systemd service first, starts one detached current-entrypoint fallback, and polls at 100 ms for no more than five seconds.
- Runner maps all six commands to exact gateway tool names/arguments and resolves URL by flag, environment, then localhost.
- Only `DAEMON_UNAVAILABLE` triggers recovery; successful recovery retries the request once, while validation, gateway, and internal failures never auto-start.
- Existing unrelated/untracked files, including build-generated `dist/cli/`, were preserved and excluded from the implementation commit.
