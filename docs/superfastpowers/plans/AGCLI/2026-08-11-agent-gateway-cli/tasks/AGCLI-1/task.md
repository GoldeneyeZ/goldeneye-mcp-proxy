### Task 1: Parse Commands and Stabilize Output

<TASK-ID>AGCLI-1</TASK-ID>

**Files:**
- Create: `src/cli/types.ts`
- Create: `src/cli/parse-cli.ts`
- Create: `src/cli/output.ts`
- Test: `tests/cli-parse.test.ts`
- Test: `tests/cli-output.test.ts`

- [ ] Write tests proving exactly six recognized commands; exact mappings for every command; shared `--url`; missing, unknown, duplicate, trailing, and invalid numeric input rejection.
- [ ] Run `node --loader ts-node/esm --test tests/cli-parse.test.ts`; expect missing-module failure.
- [ ] Implement `CliError`, discriminated `CliCommand`, `isGatewayCliCommand`, and strict cursor-based `parseCli`.

```typescript
export class CliError extends Error {
  constructor(public readonly code: string, message: string, public readonly exitCode: number) {
    super(message); this.name = "CliError";
  }
}
```

- [ ] Write output tests expecting `{"found":1}\n` on stdout and `{"error":{"code":"INVALID_ARGS","message":"bad input"}}\n` on stderr.
- [ ] Run output test; expect missing-module failure. Implement compact `writeSuccess`, `writeFailure`, and `toCliError` using injected writers.
- [ ] Run `node --loader ts-node/esm --test tests/cli-parse.test.ts tests/cli-output.test.ts`; expect PASS.
- [ ] Commit scoped files with `feat(cli): parse gateway commands and emit JSON`.
