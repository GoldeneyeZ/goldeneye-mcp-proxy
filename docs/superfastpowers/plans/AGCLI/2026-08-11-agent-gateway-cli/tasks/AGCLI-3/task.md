### Task 3: Recover Daemon and Run Commands

<TASK-ID>AGCLI-3</TASK-ID>

**Files:**
- Create: `src/cli/daemon-startup.ts`
- Create: `src/cli/run-cli.ts`
- Test: `tests/cli-daemon-startup.test.ts`
- Test: `tests/cli-run.test.ts`

- [ ] Test systemd-first ordering, health short-circuit, exactly one detached fallback, polling deadline, and false result after five seconds.
- [ ] Run daemon test; expect missing-module failure.
- [ ] Implement health URL derivation, `systemctl --user start goldeneye-mcp-proxy.service`, detached current Node entrypoint `--daemon`, injected clock/sleep/process hooks, and bounded polling.
- [ ] Test exact tool names and args for search, describe, invoke, invoke_async, invoke_status, get_result.
- [ ] Test URL priority flag → `MCP_GATEWAY_URL` → localhost; `--args -`; one retry only after `DAEMON_UNAVAILABLE`; no startup after gateway/validation failures; stable exit codes/output streams.
- [ ] Run runner test; expect missing-module failure.
- [ ] Implement `runCli(argv, deps)` orchestrating parser, args reader, `GatewayClient`, `ensureDaemon`, retry, and output.
- [ ] Run both Task 3 test files; expect PASS.
- [ ] Commit scoped files with `feat(cli): recover daemon and run gateway commands`.
