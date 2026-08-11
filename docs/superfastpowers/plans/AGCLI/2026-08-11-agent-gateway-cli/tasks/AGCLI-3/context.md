# Context for AGCLI-3

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-3`
**Commit SHAs:** `ed45ea0`, `769d8d3`
**Reviewed ranges:** `ed45ea0^..ed45ea0`, `769d8d3^..769d8d3`

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

## Endpoint Validation Repair

### Files Changed

- `src/cli/run-cli.ts`
- `tests/cli-run.test.ts`
- `tests/cli-entrypoint.test.ts`

### TDD Evidence

- RED: resolved flag/environment endpoint tests both failed with exit `0` instead of `2`; invalid URLs reached the injected gateway call.
- RED: after isolating credential-bearing HTTP(S) behavior, both tests again failed with exit `0`, proving URLs unusable by `fetch` were accepted.
- RED: built-entrypoint regression failed with exit `5` and `INTERNAL_ERROR` instead of exit `2` and `INVALID_ARGS`.
- GREEN: focused runner tests passed 9/9; focused built regression passed after compiling the repaired source.

### Verification

- `npm run build` — PASS.
- `npm test` — PASS, 113/113 tests, including clean-source package creation and extracted executable smoke tests.
- `quick_validate.py skills/using-goldeneye-cli` — `Skill is valid!`.
- `npm pack --dry-run --json` artifact assertion — PASS, 137 files with executable, compiled runner, and both skill artifacts.
- `git diff --check` — PASS.

### Notes

- The runner validates the final flag → environment → default endpoint before argument input, transport, or recovery.
- Only absolute credential-free `http:` and `https:` endpoints are accepted; failures use one generic secret-safe `INVALID_ARGS` envelope and exit `2`.
- Invalid flag/environment tests prove both gateway-call and daemon-recovery counts remain zero; built tests cover malformed and unsupported endpoints from both sources.
