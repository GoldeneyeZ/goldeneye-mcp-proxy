---
name: using-goldeneye-mcp
description: Use when an agent needs to discover, inspect, invoke, poll, or paginate tools through the Goldeneye MCP gateway while minimizing schema and response tokens.
---

# Using Goldeneye MCP

## Overview

Use Goldeneye's MCP gateway tools directly. Load only the schema and result data needed for the task.

## Known-Tool Fast Path

Use `gateway.invoke` directly when either:

- the exact tool ID and current argument schema are known; or
- the tool was invoked successfully during the current session.

Use `gateway.invoke_async` instead for known long-running work. Skip `gateway.search` and `gateway.describe` in both cases. After a schema/input mismatch, call `gateway.describe` before retrying.

## Workflow

1. Run `gateway.search` only when the exact tool ID is unknown. Select an exact returned ID.
2. Run `gateway.describe` only when the argument schema is unknown, uncertain, or rejected.
3. Run `gateway.invoke` for bounded work or `gateway.invoke_async` for long-running work.
4. Poll the returned `jobId` with `gateway.invoke_status` until `completed` or `failed`.
5. When a response contains top-level `_ref`, use `gateway.get_result` to retrieve only needed offsets, fields, or matches.

Treat returned IDs and schemas as authoritative. Pass upstream arguments inside `args`; never invent wrapper or argument names.

## Tool Map

| Need | MCP tool | Key input |
|---|---|---|
| Find exact tool ID | `gateway.search` | `query`, optional `server`, `limit` |
| Read one schema | `gateway.describe` | `id` |
| Run bounded work | `gateway.invoke` | `id`, `args`, optional `timeoutMs` |
| Queue long work | `gateway.invoke_async` | `id`, `args`, optional `priority` |
| Poll queued work | `gateway.invoke_status` | `jobId` |
| Slice shielded result | `gateway.get_result` | `ref`, optional `offset`, `limit`, `fields`, `search` |

## Example

Known tool and schema—invoke immediately:

```text
gateway.invoke
{"id":"database::query","args":{"query":"SELECT id,name FROM users"}}
```

Unknown tool—discover only what is missing:

```text
gateway.search  {"query":"database query","limit":3}
gateway.describe {"id":"database::query"}
gateway.invoke  {"id":"database::query","args":{"query":"SELECT id,name FROM users"}}
```

## Common Mistakes

- Searching or describing a known, successfully used tool again.
- Guessing IDs, schemas, wrapper names, or upstream argument names.
- Polling with anything except the returned `jobId`.
- Fetching an entire `_ref` result when a slice or search is sufficient.
