### Task 4: Integrate Executable and Preserve Legacy Modes

<TASK-ID>AGCLI-4</TASK-ID>

**Files:**
- Modify: `src/index.ts`
- Test: `tests/cli-entrypoint.test.ts`
- Use: `tests/helpers/cli-http-server.ts`

- [ ] Write built-entrypoint tests using `execFile(process.execPath, ["dist/index.js", ...])` and fake JSON daemon.
- [ ] Prove `search` emits exactly one compact stdout JSON line and empty stderr.
- [ ] Prove invalid CLI input exits `2` with one JSON stderr line.
- [ ] Prove `--help` retains `--daemon`, `--discover`, migration flags and lists all six subcommands.
- [ ] Run `npm run build && node --test tests/cli-entrypoint.test.ts`; expect search failure from legacy dispatch.
- [ ] Dispatch recognized first token to `runCli`; keep all legacy parsing/branches unchanged; expand help text.
- [ ] Run `npm run build && node --test tests/cli-entrypoint.test.ts && npm test`; expect PASS.
- [ ] Commit scoped files with `feat(cli): integrate gateway subcommands`.
