# Context for AGCLI-3

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-3`
**Commit SHAs:** `ed45ea0`, `769d8d3`, `e6cc6d8`
**Reviewed ranges:** `ed45ea0^..ed45ea0`, `769d8d3^..769d8d3`, `e6cc6d8^..e6cc6d8`

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

## Recovery Deadline Repair

### Files Changed

- `src/cli/daemon-startup.ts`
- `tests/cli-daemon-startup.test.ts`
- `tests/cli-entrypoint.test.ts`

### TDD Evidence

- RED: focused daemon test exceeded a five-second command guard because an injected health promise never settled; Node reported the test promise still pending.
- RED: built CLI against loopback `/mcp` connection drop plus `/health` never-response reached the ten-second child timeout and returned the wrong observed exit instead of stable exit `3`.
- GREEN: injected never-settling health returned `false` in 30.6-35.4 ms; never-settling systemd returned `false` in 30.1-31.6 ms. Calls remained `health` only and `health -> systemd`, with no detached start after deadline.
- GREEN: late rejection of a timed-out health promise produced no unhandled rejection; focused suite exited promptly, proving cleared operation timers.
- GREEN: built hanging-health regression returned stable exit `3` with empty stdout and one compact `DAEMON_UNAVAILABLE` stderr envelope in 5.21-5.48 seconds; server sockets and child process tore down cleanly.

### Implementation

- One absolute deadline now races every health, systemd, and sleep await, including injected promises that never settle.
- Deadline expiry aborts the default health `fetch`; aborting default systemd sends `SIGTERM` to `systemctl` and settles its promise.
- Settled operations clear deadline timers; timeout races retain rejection handlers so late dependency rejection is handled.
- Existing initial-health short-circuit, systemd-first ordering, one detached fallback, 100 ms poll cap, false-on-deadline behavior, and runner retry rules remain covered.

### Verification

- `node --loader ts-node/esm --test tests/cli-daemon-startup.test.ts tests/cli-run.test.ts` — PASS, 16/16.
- `npm run build` — PASS.
- `npm test` — PASS, 117/117; includes clean-source package/extracted CLI, built hanging-health, legacy modes, error/security, and package tests.
- Manual built command matrix — PASS, all six exact `gateway.*` mappings with compact stdout and empty stderr.
- `quick_validate.py skills/using-goldeneye-cli` — `Skill is valid!`.
- `npm pack --dry-run --json --silent` — PASS, 137 files, required executable/compiled recovery/skill artifacts present.
- `git diff --check` for implementation files — PASS.

### Notes

- Implementation commit: `e6cc6d8` (`fix(cli): bound daemon recovery operations`).
- Generated `dist` changes and unrelated worktree files remain excluded from the commit.
