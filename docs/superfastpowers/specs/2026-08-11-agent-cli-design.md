# Agent CLI Design

## Goal

Add a compact command-line interface to `goldeneye-mcp-proxy` so agents can call all six gateway operations through shell commands without loading MCP tool schemas. Bundle a skill teaching agents the efficient workflow. Skill gateway commands remain out of scope.

## Compatibility

Keep the existing executable name and all current modes unchanged:

- no arguments or a config path: stdio MCP server
- `--daemon` and `--port`: HTTP daemon
- `--discover`: catalog discovery
- existing skill migration flags

Treat a recognized first positional argument as a new CLI subcommand. Unknown options and malformed command input fail without starting stdio mode.

## Commands

```text
goldeneye-mcp-proxy search <query> [--server <key>] [--limit <n>]
goldeneye-mcp-proxy describe <tool-id>
goldeneye-mcp-proxy invoke <tool-id> --args <json|-> [--timeout <ms>]
goldeneye-mcp-proxy invoke-async <tool-id> --args <json|->
goldeneye-mcp-proxy invoke-status <job-id>
goldeneye-mcp-proxy get-result <ref> [--offset <n>] [--limit <n>] [--fields <a,b>] [--search <text>]
```

All commands accept `--url <endpoint>`. Resolution order is command flag, `MCP_GATEWAY_URL`, then `http://127.0.0.1:8767/mcp`.

`--args -` reads one JSON value from stdin. Inline JSON remains convenient for non-secret values; stdin is the documented path for secrets because command-line arguments may be visible in process listings.

## Architecture

Create focused modules under `src/cli/`:

- `types.ts`: command, dependency, and error types
- `parse-cli.ts`: deterministic argument parsing and validation
- `json-input.ts`: inline/stdin JSON object parsing
- `gateway-client.ts`: JSON-RPC `tools/call` requests and response unwrapping
- `daemon-startup.ts`: health checks, systemd start, detached fallback, bounded polling
- `output.ts`: compact JSON output and stable error envelopes
- `run-cli.ts`: orchestration and dependency injection

Keep `src/index.ts` responsible only for top-level mode dispatch. It invokes `runCli` for recognized gateway subcommands and retains existing branches for legacy modes.

The client sends JSON-RPC 2.0 requests to the existing `POST /mcp` endpoint:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gateway.search","arguments":{"query":"database"}}}
```

No REST routes or duplicate gateway logic are added. Validation, lazy upstream connection, async jobs, response shielding, and `_ref` storage remain daemon-owned.

## Response Contract

On success, unwrap both the JSON-RPC envelope and MCP text-content envelope, parse the gateway JSON text, and print exactly one compact JSON value plus newline to stdout. Do not print daemon logs or human labels.

On failure, print exactly one compact envelope to stderr:

```json
{"error":{"code":"INVALID_ARGS","message":"--args must contain a JSON object"}}
```

Stable exit codes:

- `0`: success
- `2`: usage, validation, or JSON input error
- `3`: daemon unavailable or startup timeout
- `4`: JSON-RPC or gateway tool error
- `5`: unexpected transport or internal CLI error

Never echo supplied argument JSON in error messages.

## Daemon Recovery

Before the first request, call the daemon directly. Retry startup only for connection-level failures.

1. Probe `/health`.
2. Try `systemctl --user start goldeneye-mcp-proxy.service` when systemd is available.
3. If health remains unavailable, spawn the current Node entrypoint with `--daemon` as a detached process with ignored stdio.
4. Poll health with a short bounded interval for at most five seconds.
5. Retry the gateway request once; otherwise return exit code `3`.

Do not auto-start after HTTP, JSON-RPC, validation, or gateway errors. This prevents duplicate processes when a healthy daemon rejects a request.

## Agent Skill

Create `skills/using-goldeneye-cli/` with:

- concise `SKILL.md`
- generated `agents/openai.yaml`
- no scripts or duplicated long-form reference

Trigger when an agent needs to discover, inspect, invoke, poll, or paginate MCP tools through shell commands while minimizing context and schema tokens. Teach this workflow:

1. `search`
2. `describe` before first invocation or uncertain schema
3. `invoke` or `invoke-async`
4. `invoke-status` for async jobs
5. `get-result` only for needed `_ref` slices

Include safe stdin usage for secret-bearing arguments, compact command examples, and common mistakes. Add `skills/` to the npm package files and document CLI installation/usage in `README.md` and `AGENT-CONTEXT.md`.

## Testing

Follow test-driven development. Cover:

- every command and option mapping
- missing/unknown/duplicate options and numeric validation
- inline and stdin JSON, including non-object rejection and secret-safe errors
- JSON-RPC request body, response unwrapping, remote errors, malformed responses, and network failures
- startup only on connection failures, systemd-first behavior, detached fallback, bounded polling, and retry limit
- stable stdout/stderr separation and exit codes
- built executable compatibility for legacy help/modes and new commands against a local fake daemon
- skill baseline failure, skill-guided forward test, metadata validation, and package inclusion

Run the full unit suite, TypeScript build, package dry-run inspection, and representative end-to-end CLI calls before completion.

## Non-Goals

- Skill gateway commands
- Human-formatted output
- REST gateway endpoints
- shell completion
- interactive prompts
- standalone per-command gateway instances
