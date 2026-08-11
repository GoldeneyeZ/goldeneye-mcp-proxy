# Context for AGCLI-2

**Plan:** `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
**Task:** `AGCLI-2`
**Commit SHA:** `e2e423e`
**Reviewed range:** `e2e423e^..e2e423e`

## Starting Context

- `src/transports/http/request-router.ts`: JSON-RPC routing and MCP content response.
- `src/cli/types.ts`: errors and command contracts from AGCLI-1.
- `tests/`: local HTTP test patterns.

## Open Context Rule

Files above are starting points only. Inspect any additional files needed to complete task correctly.

## Completion Updates

### Files Changed

- `src/cli/json-input.ts`
- `src/cli/gateway-client.ts`
- `tests/cli-json-input.test.ts`
- `tests/cli-gateway-client.test.ts`
- `tests/helpers/cli-http-server.ts`

### Relevant Files Inspected

- `src/cli/types.ts`
- `src/cli/output.ts`
- `src/transports/http/request-router.ts`
- `src/transports/http/json-rpc.ts`
- `tests/cli-output.test.ts`
- `package.json`
- `tsconfig.json`
- Agent CLI design, implementation plan, task, and progression policy

### TDD Evidence

- JSON-input test first failed because `src/cli/json-input.ts` did not exist.
- Gateway-client test first failed because `src/cli/gateway-client.ts` did not exist.
- After minimal implementations, both focused suites passed with 17 tests.

### Verification

- `node --loader ts-node/esm --test tests/cli-json-input.test.ts tests/cli-gateway-client.test.ts` — PASS, 17 tests.
- `npm run build` — PASS.
- `npm test` — PASS, 85 tests.
- `git diff --cached --check` — PASS before implementation commit.

### Notes

- JSON arguments accept inline or stdin plain objects; malformed and non-object inputs return secret-safe `INVALID_ARGS` errors.
- Client emits exact JSON-RPC `tools/call` requests with monotonic IDs and unwraps exactly one MCP text item containing JSON.
- Connection refusal maps to `DAEMON_UNAVAILABLE`; valid JSON-RPC errors map to `GATEWAY_ERROR`; malformed HTTP/JSON-RPC/MCP responses map to `INTERNAL_ERROR`.
- Existing unrelated/untracked files, including build-generated `dist/cli/`, were preserved and excluded from the implementation commit.
