---
name: using-goldeneye-mcp
description: Use when an agent needs to discover, inspect, invoke, poll, or paginate MCP gateway tools while minimizing schema and response tokens.
---

# Using Goldeneye MCP

## Overview

Use direct MCP for known tools. Use the `goldeneye-mcp-proxy` 1.x CLI as the compact fallback for discovery or shell-only access.

## Direct MCP Fast Path

Use direct MCP instead of this CLI when direct MCP access is available and either:

- the exact tool ID and current argument schema are known; or
- the tool was invoked successfully during the current session.

If tool identity, schema, or freshness is uncertain, use the CLI workflow below. After a direct MCP schema/input mismatch, run `describe` before retrying. Run `search` only when the exact tool ID is unknown.

## Required CLI Workflow

1. Run `search` with a natural-language capability only when the exact tool ID is unknown. Select an exact returned tool ID.
2. Run `describe` before the first invocation when its schema is unknown or uncertain. Never infer argument names.
3. Choose `invoke` for bounded work or `invoke-async` for long-running work.
4. Poll an async `jobId` with `invoke-status` until `completed` or `failed`.
5. When any result contains `_ref`, call `get-result` only for the needed offset, limit, fields, or search. Do not fetch the full payload by default.

Every command prints exactly one compact JSON value. Parse that JSON directly. Use `--url` when targeting a non-default endpoint; otherwise `MCP_GATEWAY_URL`, then `http://127.0.0.1:8767/mcp`, applies.

## Quick Reference

| Need | Command |
|---|---|
| Find tools | `goldeneye-mcp-proxy search <query> [--server <key>] [--limit <n>]` |
| Read schema | `goldeneye-mcp-proxy describe <tool-id>` |
| Run now | `goldeneye-mcp-proxy invoke <tool-id> --args <json|-> [--timeout <ms>]` |
| Queue work | `goldeneye-mcp-proxy invoke-async <tool-id> --args <json|->` |
| Poll job | `goldeneye-mcp-proxy invoke-status <job-id>` |
| Slice result | `goldeneye-mcp-proxy get-result <ref> [--offset <n>] [--limit <n>] [--fields <a,b>] [--search <text>]` |

Exit codes: `0` success; `2` input; `3` daemon unavailable; `4` gateway; `5` internal/transport. Errors are compact JSON on stderr and never echo supplied argument JSON.

## Example

```bash
goldeneye-mcp-proxy search "database query" --limit 3
goldeneye-mcp-proxy describe 'database::query'

read -rsp 'Database password: ' DB_PASSWORD; printf '\n'; export DB_PASSWORD
job_json=$(node -e 'process.stdout.write(JSON.stringify({query:"SELECT id,name FROM users",password:process.env.DB_PASSWORD}))' \
  | goldeneye-mcp-proxy invoke-async 'database::query' --args -)
unset DB_PASSWORD
job_id=$(printf '%s' "$job_json" | jq -r '.jobId')
goldeneye-mcp-proxy invoke-status "$job_id"
goldeneye-mcp-proxy get-result '<returned-_ref>' --offset 0 --limit 50 --fields id,name
```

## Common Mistakes

- Using CLI discovery when direct MCP is available and the exact tool ID/current schema are known.
- Calling `gateway.search` as a CLI subcommand: use `search`.
- Guessing schemas or wrapper names such as `tool_id`/`arguments`: use `describe`, then pass only upstream args to `--args`.
- Putting secrets in inline JSON: pipe generated JSON to `--args -`.
- Polling with anything except the returned `jobId`, or downloading all `_ref` data.
