### Task 2: Parse JSON and Call Gateway JSON-RPC

<TASK-ID>AGCLI-2</TASK-ID>

**Files:**
- Create: `src/cli/json-input.ts`
- Create: `src/cli/gateway-client.ts`
- Create: `tests/helpers/cli-http-server.ts`
- Test: `tests/cli-json-input.test.ts`
- Test: `tests/cli-gateway-client.test.ts`

- [ ] Test inline and stdin objects; reject arrays/scalars/malformed JSON without echoing input.
- [ ] Run `node --loader ts-node/esm --test tests/cli-json-input.test.ts`; expect missing-module failure.
- [ ] Implement `readArgs(source, readStdin)` returning `Record<string, unknown>` or `CliError("INVALID_ARGS", ..., 2)`.
- [ ] Create disposable local JSON server helper using `node:http`, ephemeral port, captured request body, and async close.
- [ ] Test exact JSON-RPC body, compact content unwrapping, connection refusal as `DAEMON_UNAVAILABLE`, remote error as `GATEWAY_ERROR`, malformed response as internal failure.

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"gateway.search","arguments":{"query":"db"}}}
```

- [ ] Run client test; expect missing-module failure. Implement `GatewayClient.call` with Node `fetch`, incrementing IDs, JSON validation, and one text-content JSON parse.
- [ ] Run both Task 2 test files; expect PASS.
- [ ] Commit scoped files with `feat(cli): call gateway over JSON-RPC`.
