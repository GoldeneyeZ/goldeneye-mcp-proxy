# Feature Package Refactor Design

## Context

`goldeneye-mcp-proxy` is a TypeScript ESM MCP proxy with a flat `src/` directory. The package exposes the CLI binary through `dist/index.js` and currently supports stdio, HTTP daemon, and catalog discovery modes.

The current layout works, but several files carry multiple responsibilities:

- `http-server.ts` handles HTTP lifecycle, JSON-RPC protocol details, tool schemas, tool execution, and response formatting.
- `handlers.ts` registers stdio tools and duplicates much of the HTTP gateway tool behavior.
- `gateway.ts` wires services, owns startup modes, handles config reloads, and contains project argument injection and async job execution logic.
- `connections.ts` owns upstream connection state, transport creation, catalog refresh, retry, idle disconnect, and stats.
- `response-store.ts` owns both stored response pagination and response shielding transformations.

The baseline TypeScript check passes with `tsc --noEmit`.

## Goal

Reorganize the codebase into feature packages and split large classes/functions where doing so improves clean-code boundaries. Preserve public runtime behavior, CLI modes, package entrypoint, and gateway tool contracts.

## Non-Goals

- Do not redesign the MCP protocol behavior.
- Do not change the public CLI entrypoint or package binary target.
- Do not introduce a heavy ports/adapters framework.
- Do not perform unrelated feature work during the migration.

## Recommended Approach

Use feature packages with targeted internal splits. This balances maintainability and risk for a small TypeScript CLI/library.

The refactor should prioritize:

1. Removing duplicated gateway tool behavior between stdio and HTTP.
2. Giving large files narrower responsibilities.
3. Keeping imports and package structure understandable without adding unnecessary abstraction.
4. Preserving behavior through incremental moves and compile checks.

## Target Structure

```text
src/
  index.ts
  gateway/
    MCPGateway.ts
    gateway-status.ts
    project-args.ts
  config/
    Config.ts
    lazy-config.ts
  catalog/
    CatalogSnapshotManager.ts
  upstreams/
    ConnectionManager.ts
    connection-state.ts
    environment.ts
    resource-monitor.ts
  tools/
    gateway-tool-schemas.ts
    GatewayToolService.ts
    stdio-tool-registration.ts
  transports/
    http/
      HttpMcpServer.ts
      json-rpc.ts
      request-router.ts
      cors.ts
  responses/
    ResponseStore.ts
    ResponseShield.ts
    response-slicing.ts
    response-truncation.ts
  jobs/
    JobManager.ts
  search/
    SearchEngine.ts
    schema-fields.ts
  projects/
    ProjectRegistry.ts
  shared/
    types.ts
```

This structure is a target, not a mandate for churn. If an extraction does not make the code easier to understand or test, keep the code together.

## Architecture

`MCPGateway` remains the composition root. It should own config loading, service construction, startup modes, config reload behavior, and shutdown. Business behavior should move into feature packages.

The central architectural change is `tools/GatewayToolService`. It should implement the transport-neutral behavior for:

- `gateway.search`
- `gateway.describe`
- `gateway.invoke`
- `gateway.invoke_async`
- `gateway.invoke_status`
- `gateway.get_result`

Both stdio tool registration and HTTP JSON-RPC routing should delegate to this service. Transport layers should own protocol mapping, schemas, and response formatting, but not duplicate core tool behavior.

## Component Responsibilities

### Gateway

`gateway/MCPGateway.ts` wires all services and owns lifecycle behavior. Smaller helpers should hold:

- status snapshots exposed by `gateway.status`
- project path injection for code graph arguments
- async job execution callback setup

### Tools

`tools/GatewayToolService.ts` owns core gateway tool use cases. It depends on search, connections, jobs, response shielding, and status access.

`tools/stdio-tool-registration.ts` maps MCP SDK `server.registerTool(...)` calls to `GatewayToolService`.

`tools/gateway-tool-schemas.ts` contains shared schema metadata where HTTP and stdio can reasonably share it. Zod-specific stdio schemas and JSON-schema HTTP schemas can remain separate if forcing one shared representation adds complexity.

### HTTP Transport

`transports/http/HttpMcpServer.ts` handles server lifecycle and request entrypoints.

`transports/http/json-rpc.ts` owns JSON-RPC success/error helpers and request/response types.

`transports/http/request-router.ts` routes MCP methods such as `initialize`, `notifications/initialized`, `ping`, `tools/list`, and `tools/call`.

`transports/http/cors.ts` handles CORS headers and preflight behavior.

### Responses

`responses/ResponseStore.ts` owns storage, refs, pagination, field projection, and search within stored responses.

`responses/ResponseShield.ts` coordinates response shielding and delegates pure transformations to helpers:

- array truncation
- heavy-field stripping
- string truncation
- max-size enforcement
- stored result slicing metadata

### Upstreams

`upstreams/ConnectionManager.ts` remains the public facade for upstream lifecycle:

- connect and retry
- ensure connected
- disconnect and remove server
- idle monitoring
- stats

Focused helpers should hold environment variable parsing, connection state transitions, resource monitoring, and catalog-refresh support where the split reduces complexity.

### Search

`search/SearchEngine.ts` stays the public search facade. Schema field extraction and search document shaping should move into helpers when extracted.

### Shared Types

Start with `shared/types.ts` for common contracts. During implementation, move types closer to their feature package only when it reduces coupling and does not create import churn.

## Data Flow

```text
CLI args
  -> MCPGateway
    -> Config
    -> SearchEngine
    -> ConnectionManager
    -> CatalogSnapshotManager
    -> JobManager
    -> ResponseStore / ResponseShield
    -> GatewayToolService
    -> stdio or HTTP transport
```

Stdio flow:

```text
MCP SDK server
  -> stdio-tool-registration
  -> GatewayToolService
  -> feature services
  -> MCP tool content response
```

HTTP flow:

```text
HTTP request
  -> HttpMcpServer
  -> JSON-RPC router
  -> GatewayToolService
  -> feature services
  -> JSON-RPC response
```

## Error Handling

Preserve current error behavior:

- HTTP JSON-RPC should keep equivalent codes and messages for parse errors, invalid requests, invalid params, unknown methods, unknown tools, missing tools, connection failures, and upstream invocation errors.
- Stdio tool calls should continue returning MCP tool content in the same shape.
- Shielded responses should continue exposing `_ref`, `_truncated`, and guidance for retrieving full data.
- Lazy loading and catalog fallback should remain unchanged: snapshots are searchable at startup, upstreams connect on demand, idle connections disconnect, and config reload reconciles server changes.
- Shutdown should stop watchers and monitors, stop jobs, disconnect upstreams, and stop HTTP server when active.

## Verification

Use incremental verification:

- Run `tsc --noEmit` before and after meaningful moves.
- Run `npm run build` before completion.
- Preserve `package.json` binary mapping to `dist/index.js`.
- Use the existing HTTP notification script when a daemon is available.
- Add focused tests for extracted pure helpers where feasible, especially JSON-RPC helpers and response truncation helpers.

## Migration Notes

Move in small steps:

1. Introduce feature folders and move low-risk files with import updates.
2. Extract transport-neutral gateway tool behavior into `GatewayToolService`.
3. Update stdio and HTTP paths to delegate to the service.
4. Split response shielding helpers.
5. Split HTTP JSON-RPC helpers.
6. Split upstream helper responsibilities where the benefit is clear.
7. Remove temporary compatibility exports and stale files.
8. Run final build and targeted behavior checks.

Avoid broad rewrites. Each extraction should be behavior-preserving unless a bug is discovered and documented separately.
