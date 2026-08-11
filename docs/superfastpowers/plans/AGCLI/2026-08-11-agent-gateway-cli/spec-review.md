# Agent Gateway CLI Spec Review

Result: failed

Reviewed: 2026-08-11 12:43 CEST

## Scope

- Specification: `docs/superfastpowers/specs/2026-08-11-agent-cli-design.md`
- Plan: `docs/superfastpowers/plans/AGCLI/2026-08-11-agent-gateway-cli.md`
- Tasks and contexts: `AGCLI-1` through `AGCLI-5`
- Implementation range: `b9f1a2f..fb8d142`
- Additional evidence: current generated `dist/index.js`, `dist/index.js.map`, and untracked `dist/cli/`

## Findings

### 1. Blocking: the reviewed commits do not produce a usable CLI package from a clean checkout

`package.json:14-18` publishes `dist/index.js` as the executable and includes `dist/`, but `package.json:27-32` builds only in `prepublishOnly`. The implementation commits exclude the generated CLI distribution: at `fb8d142`, `dist/cli/` does not exist and committed `dist/index.js` contains neither `runCli` nor `isGatewayCliCommand`. A clean archive of `fb8d142` therefore reports only the stale `dist/index.*` files plus the skill in `npm pack --dry-run --json`; no `dist/cli/*` files are present.

The current working tree passes package inspection only because `npm run build` left modified/untracked `dist` files outside the reviewed range. This contradicts the design's package-inclusion requirement and the plan-wide gate that a dry-run package contain the compiled CLI modules.

Related test gap: `tests/cli-package.test.ts:14-18` checks only the two skill files, so it passes with a stale executable and no `dist/cli/` modules.

### 2. Blocking: built legacy-mode compatibility coverage required by the specification is incomplete

The design requires built-executable compatibility coverage for legacy help/modes. `tests/cli-entrypoint.test.ts:32-91` covers a built `search`, malformed recognized CLI input, and help text. It does not execute or assert the preserved no-argument/config-path stdio dispatch, `--daemon`, `--port`, `--discover`, or skill-migration modes. Static inspection shows `src/index.ts:41-97` retained the old branches, but that is not the required executable-level test evidence.

### 3. Blocking: agent-facing CLI documentation teaches the wrong truncation reference shape

`AGENT-CONTEXT.md:228-233` shows an invocation returning `metadata: { ref: "r3" }`, then instructs retrieval only when `_ref` is present. The actual gateway contract adds top-level `_ref` and `_truncated` fields (`src/tools/GatewayToolService.ts:133-141`), as the bundled skill correctly states. The stale example can cause an agent to look in the wrong field and miss selective retrieval.

## Verified Coverage

- All six parser commands and documented options map to the exact six `gateway.*` tool names.
- Inline/stdin JSON object validation is secret-safe.
- JSON-RPC `tools/call`, MCP text unwrapping, gateway errors, malformed responses, and connection classification are implemented.
- Recovery probes health, tries systemd before one detached fallback, polls within five seconds, and retries one gateway request only after `DAEMON_UNAVAILABLE`.
- Success/error output is one compact JSON line on the correct stream with exit codes 0/2/3/4/5.
- Current generated executable completed successful live calls for `search`, `describe`, `invoke`, `invoke-async`, `invoke-status`, and `get-result`.
- Connection-refusal smoke test exited 3 after approximately 5.2 seconds with one compact error envelope.
- `npm test`: 101 passed, 0 failed.
- `npm run build`: passed.
- Skill validation with `quick_validate.py`: passed.
- Current-worktree `npm pack --dry-run --json` contains both skill files, `dist/index.js`, and all `dist/cli/*` modules.
- Skill is 374 words, has valid generated metadata, teaches search/describe/invoke, async polling, selective `_ref` retrieval, stdin secrets, exit codes, and common mistakes. Recorded baseline and forward-test behavior addresses the observed syntax, schema, secret, job-ID, and pagination gaps.
- `git diff --check b9f1a2f..fb8d142` and current `git diff --check`: passed.

## Progression

- Spec review: failed
- Code quality: unchecked
- Integration review: unchecked
- Next action: repair the findings in `implementer-handoff.md`, then rerun this plan-scoped spec review.

---

## Rerun — 2026-08-11 13:04 CEST

Result: failed

Reviewed range: `b9f1a2f..b4e7dfb`, repair evidence commit `b0b4ffe`, and current generated `dist`

### Prior blocker closure

- Clean package: repaired. `prepack` builds from a source-only fixture; package tests require `dist/index.js`, every source-derived `dist/cli/*.js`, both skill files, packed help, and packed fake-daemon `search` dispatch.
- Legacy built coverage: repaired. Built-process tests exercise no-arg/config stdio, `--daemon`, `--port`, `--discover`, every migration mode, help, CLI success, and CLI failure with bounded teardown.
- `_ref` docs: repaired. Agent docs now use top-level `_ref`/`_truncated`; `rg` finds no `metadata.ref` in CLI docs or skill.

### Fresh findings

#### 1. Blocking: unknown top-level options still start stdio

The compatibility contract requires unknown options to fail without starting stdio (`docs/superfastpowers/specs/2026-08-11-agent-cli-design.md:16`). Top-level dispatch sends every token other than the six recognized subcommands to legacy parsing (`src/index.ts:34-39`), while the legacy loop silently ignores unknown `--...` options (`src/index.ts:52-74`). Executing `node dist/index.js --wat /dev/null` printed `goldeneye-mcp-proxy starting (stdio)...` and `__MCP_GATEWAY_STDIO_READY__` and remained running until terminated. No built regression test covers an unknown top-level option.

#### 2. Blocking: malformed CLI input can echo supplied argument JSON

The response contract says never to echo supplied argument JSON (`docs/superfastpowers/specs/2026-08-11-agent-cli-design.md:73`). `parseOptions` embeds any unexpected positional token verbatim in its error (`src/cli/parse-cli.ts:83-88`). Executing `node dist/index.js invoke srv::tool '{"password":"TOP_SECRET_7391"}'` exited 2 but printed the full JSON, including `TOP_SECRET_7391`, in the error envelope. Existing tests check secret safety only after `--args` reaches JSON parsing; parser malformed-input tests assert only that an error is thrown.

### Independently verified coverage

- `npm test`: 106 passed, 0 failed, including clean-source package creation, packed executable, and bounded legacy process tests.
- `npm run build`: passed.
- `quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`; skill length 374 words.
- Built fake daemon: all six commands exited 0, emitted one compact stdout JSON line with empty stderr, and sent exact names `gateway.search`, `gateway.describe`, `gateway.invoke`, `gateway.invoke_async`, `gateway.invoke_status`, `gateway.get_result` with correct representative arguments.
- Parser/runner tests cover every documented command and option mapping, URL precedence, inline/stdin objects, numeric constraints, exact tool arguments, one retry boundary, stream separation, and exit codes.
- JSON-RPC client tests cover exact `tools/call` body, request IDs, connection refusal, JSON-RPC errors, envelope/content validation, and malformed gateway JSON.
- Daemon tests cover health derivation, health short-circuit, systemd-first order, one detached fallback, five-second polling budget, and retry limit.
- README, `AGENT-CONTEXT.md`, and bundled skill document install/use, safe stdin secrets, async polling, and selective `_ref` retrieval.
- `git diff --check b9f1a2f..HEAD` and current `git diff --check`: passed.

### Progression

- Spec review: failed
- Code quality: unchecked
- Integration review: unchecked
- Next action: repair both fresh findings in `implementer-handoff.md`, then rerun plan-scoped spec review.

---

## Rerun 3 — 2026-08-11 13:26 CEST

Result: failed

Reviewed range: `e15f9e3^..a5c91fa`, metadata through `06a11be`, plus current generated `dist`

### Prior finding closure

- Clean package/extracted CLI: remains resolved. A source-only fixture runs `prepack`, contains `dist/index.js`, all seven `dist/cli/*.js` modules, and both skill files; its extracted executable passes help and fake-daemon dispatch.
- Built legacy compatibility: remains resolved. Built-process tests cover no-argument and config-path stdio, `--daemon`, `--port`, `--discover`, all four migration modes, help, gateway CLI success, and gateway CLI failures.
- `_ref` documentation: remains resolved. README, `AGENT-CONTEXT.md`, and skill use top-level `_ref`/`_truncated` and teach selective retrieval.
- Unknown legacy options: resolved by `a5c91fa`. Unknown options plus missing, nonnumeric, zero, and out-of-range `--port` values exit `2`, emit one compact stderr envelope, and never enter stdio.
- Secret-bearing malformed parser input: resolved by `2e87802`. Unexpected positional/option diagnostics no longer interpolate uncontrolled tokens; built and unit regressions prove supplied JSON absent from stderr.

### Fresh finding

#### 1. Blocking: malformed or unsupported `--url` values bypass validation and can enter daemon recovery

Every command accepts `--url`, malformed command input must fail deterministically, validation failures use exit `2`, and daemon startup is forbidden after validation errors (`docs/superfastpowers/specs/2026-08-11-agent-cli-design.md:16,35,67-78`). The parser accepts any nonempty string as a URL (`src/cli/parse-cli.ts:29-75,112-119`). `GatewayClient` then classifies every `fetch` rejection as `DAEMON_UNAVAILABLE` (`src/cli/gateway-client.ts:18-34`), so `runCli` enters recovery (`src/cli/run-cli.ts:25-32`).

Built evidence:

- `search x --url not-a-url` exits `5` with `INTERNAL_ERROR` because recovery's `new URL(...)` throws, instead of returning validation exit `2`.
- `search x --url file:///tmp/gateway.sock` enters the recovery path, waits about 5.4 seconds, and exits `3`; source inspection shows that path probes health, invokes user systemd, and tries the detached daemon (`src/cli/daemon-startup.ts:25-51,54-75`). `file:` is unsupported by Node HTTP `fetch`, so this is malformed endpoint input, not a connection failure.

No parser, runner, or built-entrypoint test covers invalid URL syntax/protocol. Repair by validating the resolved endpoint before the first request (including `MCP_GATEWAY_URL`) as an absolute `http:` or `https:` URL, returning a secret-safe `INVALID_ARGS` / exit `2` error without calling `ensureDaemon`. Add unit and built-process regressions for malformed and unsupported flag/env endpoints plus valid flag/env/default precedence.

### Independently verified coverage

- `npm test`: 110 passed, 0 failed; includes clean-source package construction, extracted packed executable, all built legacy modes, parser, JSON input, client, recovery, runner, and package tests.
- `npm run build`: passed.
- `quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`.
- `npm pack --dry-run --json`: 137 files; includes `dist/index.js`, seven compiled CLI JavaScript modules, and both skill artifacts.
- Manual built fake-daemon matrix: all six commands exited `0`, wrote one compact stdout JSON line with empty stderr, and sent exact tool names/representative arguments for `gateway.search`, `gateway.describe`, `gateway.invoke`, `gateway.invoke_async`, `gateway.invoke_status`, and `gateway.get_result`.
- Connection-refusal smoke: exit `3` after about 5.3 seconds, empty stdout, one compact `DAEMON_UNAVAILABLE` stderr envelope.
- Source/tests confirm exact option mappings, inline/stdin plain-object input, secret-safe parser/JSON errors, JSON-RPC request/unwrapping/error classification, systemd-first + one detached fallback + bounded polling + one request retry, URL precedence, and stable output streams/exit codes apart from the invalid-URL finding.
- Skill is 374 words, generated metadata validates, and it teaches search -> describe -> sync/async invocation -> status polling -> selective `_ref` retrieval, stdin secrets, endpoint precedence, exit codes, and common mistakes. Baseline and forward-test evidence remains recorded in `tasks/AGCLI-5/context.md`.
- `git diff --check e15f9e3^..HEAD` and current `git diff --check`: passed. Existing unrelated untracked files and generated `dist` changes were not modified by this review.

### Progression

- Spec review: failed
- Code quality: unchecked
- Integration review: unchecked
- Next action: repair invalid endpoint validation/recovery classification from `implementer-handoff.md`, then rerun plan-scoped spec review.

---

## Rerun 4 — 2026-08-11 13:38 CEST

Result: failed

Reviewed range: `e15f9e3^..769d8d3`, metadata through `e12f85b`, plus the current worktree and generated `dist`

### Prior blocker-family status

- Clean package/stale distribution: resolved. Fresh `npm test` passed both clean-source pack tests; independent `npm pack --dry-run --json` ran `prepack` and contained `dist/index.js`, all seven source-derived `dist/cli/*.js` modules, and both skill artifacts.
- Built legacy modes: resolved for the required no-argument/config stdio, `--daemon`, `--port`, `--discover`, all four skill-migration modes, and help paths. Built-process tests execute each path with bounded teardown.
- Top-level `_ref` documentation: reopened by finding 2 below. The CLI-first examples are correct, but the same agent-facing document retains a contradictory metadata claim.
- Strict top-level legacy options: reopened by finding 1 below. Double-dash unknown options and malformed ports are fixed, but single-dash unknown options are not rejected.
- Secret-safe parser diagnostics: resolved. Unit and built regressions pass; uncontrolled parser tokens and supplied JSON are absent from emitted diagnostics.
- Resolved URL validation/no recovery: resolved. Flag and environment endpoints are validated before stdin, transport, or recovery; malformed, unsupported, and credential-bearing endpoints return generic `INVALID_ARGS` / exit `2` with zero calls and zero recovery attempts.

### Findings

#### 1. Blocking: unknown single-dash top-level options still start stdio

The compatibility contract says unknown options fail without starting stdio (`docs/superfastpowers/specs/2026-08-11-agent-cli-design.md:16`). `validateLegacyArgs` rejects only arguments beginning with `--` (`src/index.ts:60-74`), while `runLegacyMode` treats any other unrecognized token, including `-wat`, as a config path (`src/index.ts:89-110`). Independent built evidence with an isolated empty environment ran `dist/index.js -wat`: it emitted `__MCP_GATEWAY_STDIO_READY__`, logged `goldeneye-mcp-proxy starting (stdio)...`, and remained alive until the two-second test timeout (`124`) instead of emitting compact `INVALID_ARGS` / exit `2`. Existing regression coverage tests `--wat`, but no unknown single-dash option (`tests/cli-entrypoint.test.ts:202-220`). The known `-h` alias must remain valid.

#### 2. Blocking: agent-facing truncation docs still give a false metadata location

`AGENT-CONTEXT.md:158-160` says truncated invocation `metadata` includes `ref`, then separately mentions top-level `_ref`. The authoritative implementation adds only top-level `_ref`, `_truncated`, and `_note` to the shielded response (`src/tools/GatewayToolService.ts:133-141`). This contradicts the design's agent workflow and can make agents inspect a nonexistent `metadata.ref`. CLI-first examples at `AGENT-CONTEXT.md:228-233`, README, and the bundled skill correctly use top-level `_ref`, but they do not neutralize the earlier false statement.

### Independently verified coverage

- `npm run build && npm test`: PASS, 113/113 tests.
- `quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`; `SKILL.md` is 374 words and has only generated `agents/openai.yaml` beside it.
- `npm pack --dry-run --json`: PASS, 137 files, no required CLI or skill artifact missing.
- Manual built fake-daemon matrix: all six commands exited `0`, emitted exactly one compact stdout JSON line with empty stderr, and sent the exact six `gateway.*` names with correct representative arguments/options.
- Source/tests verify inline and stdin JSON objects, non-object/malformed rejection, secret-safe messages, exact JSON-RPC `tools/call`, MCP text unwrapping, remote/malformed/network classifications, systemd-first recovery, one detached fallback, bounded polling, one retry, stable streams, and exit codes `0/2/3/4/5`.
- README and bundled skill document installation/use, search -> describe -> invoke/async -> status -> selective retrieval, stdin for secrets, endpoint precedence, and common mistakes.
- `git diff --check` and `git diff --check e15f9e3^..HEAD`: PASS.
- Existing unrelated worktree files and generated `dist` changes were inspected but not altered by this review.

### Progression

- Spec review: failed
- Code quality: unchecked
- Integration review: unchecked
- Next action: repair both rerun-4 findings in `implementer-handoff.md`, then rerun this plan-scoped spec review.

---

## Rerun 5 — 2026-08-11 13:59 CEST

Result: failed

Reviewed range: `e15f9e3^..4117154`, including implementation/repair commits through `20750e5` and `5319b69`, plus the current worktree and generated `dist`

### Prior blocker-family status

- Clean package/stale distribution: resolved. Fresh full tests rebuilt a source-only fixture during package tests, produced a tarball, extracted it, verified all six help entries, and dispatched packed `search` through the exact `gateway.search` JSON-RPC body. Independent `npm pack --dry-run --json --silent` reported 137 files with `dist/index.js`, all seven source-derived `dist/cli/*.js` modules, `SKILL.md`, and `agents/openai.yaml`; nothing required was missing.
- Built legacy modes: resolved. Fresh built-process tests exercised no-argument/config stdio, `--daemon`, `--port`, `--discover`, all four migration modes, both help aliases, and bounded teardown.
- Strict top-level options, including unknown single-dash tokens: resolved by `20750e5`. Independent built `-wat` exited `2`, emitted empty stdout and one generic compact stderr envelope, did not echo the token, and did not start stdio. Built `-h` exited `0` with complete legacy/new help and empty stderr.
- Secret-safe malformed input and endpoint validation: resolved. Independent built checks for uncontrolled positional JSON, malformed stdin JSON, and credential-bearing URL data returned exit `2`, one compact stderr envelope, empty stdout, and no supplied secret. Runner tests prove invalid flag/environment endpoints make zero gateway/recovery calls.
- Agent-facing truncation references: resolved by `5319b69`. `AGENT-CONTEXT.md`, README, and bundled skill consistently use top-level `_ref`; a repository-wide non-historical Markdown/YAML scan found no metadata-ref claim. Fresh doc-contract package test passed.

### Fresh finding

#### 1. Blocking: daemon recovery deadline does not bound health or systemd operations

The response contract defines exit `3` for a daemon startup timeout, and recovery must poll health for at most five seconds (`docs/superfastpowers/specs/2026-08-11-agent-cli-design.md:76-90`; plan Task 3 requires a five-second deadline). `ensureDaemon` computes a deadline but awaits the initial health probe and systemd start without applying the remaining deadline (`src/cli/daemon-startup.ts:30-38`). Default health uses bare `fetch(url)` with no abort signal (`src/cli/daemon-startup.ts:54-62`), and default systemd startup uses `execFile` with no timeout (`src/cli/daemon-startup.ts:64-66`). The deadline constrains only sleeps and loop entry, not these awaited operations.

Independent isolated evidence, with no process-start mutation:

- A loopback `/health` endpoint that accepted the request and never responded was passed to default `ensureDaemon(..., 200)`. An external race fired after 755 ms with `{"kind":"external-timeout"}`; recovery had not returned despite its 200 ms deadline.
- Injected `health: async () => false` plus a never-resolving `startSystemd`, passed to `ensureDaemon(..., 100)`, remained pending until an external 501 ms timeout.

Existing daemon tests use immediately resolving injected health/systemd functions, so their deadline assertions do not cover either real blocking boundary. A hung health endpoint or systemctl process can therefore prevent the promised bounded startup failure and compact exit-3 result indefinitely.

Repair by applying the single recovery deadline to each health probe and systemd attempt (abort/terminate timed-out default operations and race injected operations safely), while retaining health short-circuit, systemd-first order, exactly one detached fallback, 100 ms maximum poll interval, and one gateway retry. Add deterministic regressions for never-resolving health and systemd dependencies plus a built or default-dependency hanging-health regression proving bounded return and stable exit behavior.

### Independently verified coverage

- `npm run build && npm test`: PASS, 114/114 tests.
- Skill validation: `Skill is valid!`; `SKILL.md` remains 374 words and its directory contains only `SKILL.md` plus generated `agents/openai.yaml`.
- Independent built fake-daemon matrix: all six commands exited `0`, emitted exactly one compact stdout line with empty stderr, and mapped representative options to `gateway.search`, `gateway.describe`, `gateway.invoke`, `gateway.invoke_async`, `gateway.invoke_status`, and `gateway.get_result` with exact argument objects.
- Independent remote-error matrix: JSON-RPC error exited `4` with generic `GATEWAY_ERROR`; malformed MCP text JSON exited `5` with generic `INTERNAL_ERROR`; neither leaked remote detail and neither entered recovery.
- Source/tests cover command recognition, every option mapping, numeric/duplicate/missing/trailing rejection, URL precedence and validation, inline/stdin plain objects, JSON-RPC request IDs and envelope checks, output stream separation, stable codes `0/2/3/4/5`, recovery ordering/fallback/retry under resolving dependencies, legacy compatibility, package inclusion, and agent workflow documentation.
- Recorded baseline/forward-agent results map to the shipped 374-word skill; actual skill inspection confirms search → describe → sync/async invoke, job polling, selective top-level `_ref` retrieval, stdin secrets, endpoint precedence, exits, quick reference, one end-to-end example, and common mistakes.
- `git diff --check e15f9e3^..4117154` and current `git diff --check`: PASS. Existing unrelated files and generated distribution changes were not altered by this review.

### Progression

- Spec review: failed
- Code quality: unchecked
- Integration review: unchecked
- Next action: repair the bounded-recovery finding in `implementer-handoff.md`, then rerun plan-scoped spec review.

---

## Rerun 6 — 2026-08-11 14:15 CEST

Result: failed

Reviewed range: `e15f9e3^..db75c9b`, including deadline repair `e6cc6d8`, its metadata commit `db75c9b`, and the complete current worktree/generated distribution

### Prior blocker-family status

- Clean package/stale distribution: resolved. Fresh full tests built a source-only package fixture, produced and extracted a real tarball, checked all six help entries, and dispatched packed `search` through the exact JSON-RPC body. Independent `npm pack --dry-run --json --silent` reported 137 files with `dist/index.js`, all seven compiled CLI JavaScript modules, `SKILL.md`, and `agents/openai.yaml`; required missing count was zero.
- Built legacy modes: resolved. Fresh built-process coverage passed no-argument/config stdio, `--daemon`, `--port`, `--discover`, all four migration modes, `--help`, and `-h`, with bounded teardown.
- Strict top-level option validation: resolved. Fresh built tests passed unknown `--wat` and `-wat`, malformed ports, and secret-safe malformed recognized-command input without entering stdio.
- Secret-safe JSON/parser/endpoint errors: resolved. Unit and built tests passed malformed/non-object inline and stdin JSON, uncontrolled positionals, malformed/unsupported/credential-bearing URLs, zero recovery for invalid endpoints, and generic diagnostics. Independent built remote, malformed-response, and parser smokes returned exact exit codes `4`, `5`, and `2`, empty stdout, one compact stderr line, and no supplied/remote secret.
- Agent-facing top-level `_ref` docs and bundled skill: resolved. Fresh documentation contract passed; README, `AGENT-CONTEXT.md`, and skill consistently teach top-level `_ref`. Official skill validation returned `Skill is valid!`; the 374-word skill directory contains only `SKILL.md` and generated `agents/openai.yaml`.
- Health-probe deadline and cleanup: resolved by `e6cc6d8`. Fresh default-dependency built hanging-health regression exited `3` after about 5.5 seconds with empty stdout and one compact error, and loopback sockets were torn down.
- Injected systemd deadline: resolved by `e6cc6d8`. Fresh unit tests prove a never-settling injected systemd promise returns false at the deadline with `health -> systemd` ordering and no detached start.
- Default systemd process cleanup: not resolved; blocking finding below.

### Finding

#### 1. Blocking: timed-out default systemd startup can leave a live child and keep the CLI alive

Recovery promises a bounded startup timeout and the rerun-5 handoff explicitly required timed-out default systemd execution to be terminated and cleaned up. The default `startSystemd` abort path sends one `SIGTERM` and immediately resolves false (`src/cli/daemon-startup.ts:76-95`); it neither waits for child exit nor escalates when the child ignores `SIGTERM`. `awaitDeadline` then considers the operation settled (`src/cli/daemon-startup.ts:140-169`), but the live `execFile` child and its stdio handles can keep the Node CLI event loop alive indefinitely, preventing the promised compact exit-3 process result.

Independent default-dependency evidence used an isolated fake `systemctl` that recorded its exact PID, ignored `SIGTERM`, and stayed alive. Aborting `createDefaultDaemonStartupDeps().startSystemd` settled false, but after an additional 80 ms the recorded child PID `547644` still answered signal 0 (`{"value":false,"settledMs":112,"pid":547644,"alive":true}`). The reviewer then sent `SIGKILL` to that exact PID and removed the temporary fixture. This is the real default child-process boundary, not an injected never-resolving mock.

Existing coverage does not catch this. The systemd deadline regression injects a promise and has no OS child (`tests/cli-daemon-startup.test.ts:98-115`). The built hanging endpoint consumes the full deadline in the initial health request, so it never executes systemd (`tests/cli-entrypoint.test.ts:130-157,192-208`). Thus all 117 tests can pass while default systemd cleanup remains unbounded.

Repair default systemd cancellation so deadline completion also guarantees child teardown: wait for confirmed `exit`/`close`, add bounded escalation to `SIGKILL` when `SIGTERM` is ignored, and clean timers/listeners/stdio handles without double settlement or unhandled late errors. Add a real default-dependency or built-process regression with a fake `systemctl` that ignores `SIGTERM`; prove stable exit `3` within a bounded window and prove the recorded PID no longer exists afterward. Preserve the one absolute deadline, systemd-first order, one detached fallback, health short-circuit, at-most-100-ms polling, and one request retry.

### Independently verified coverage

- `npm run build && npm test`: PASS, 117/117 tests.
- `quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`; skill is 374 words and has exactly two files.
- Clean-source dry-run pack plus extracted real-package smoke: PASS; 137 files and zero required CLI/skill artifacts missing.
- Independent built fake-daemon matrix: all six commands exited `0`, emitted one compact stdout line with empty stderr, and sent exact names/arguments for `gateway.search`, `gateway.describe`, `gateway.invoke`, `gateway.invoke_async`, `gateway.invoke_status`, and `gateway.get_result`.
- Built legacy, validation, endpoint, hanging-health, JSON-RPC error, malformed response, parser-secret, output-stream, and stable exit-code coverage: PASS except for the default-systemd child cleanup finding.
- Source inspection confirms exact options/mappings, flag -> environment -> default URL precedence, inline/stdin plain-object input, systemd-first recovery, one detached fallback, and one retry after connection failure only.
- `git diff --check e15f9e3^..HEAD` and current `git diff --check`: PASS. Pre-existing unrelated/untracked files, generated `dist` changes, and AGCLI-4 context dirt were not edited by this review.

### Progression

- Spec review: failed
- Code quality: unchecked
- Integration review: unchecked
- Next action: repair and regression-test default systemd child cleanup from `implementer-handoff.md`, then rerun plan-scoped spec review.

---

## Rerun 7 — 2026-08-11 14:28 CEST

Result: passed

Reviewed range: `e15f9e3^..d1d1087`, including the complete implementation and repair history, all task files and contexts, the current source/tests/docs/skill/package manifest, and the generated distribution used by built-process verification.

### Requirement audit

- Six-command surface: passed. The parser recognizes only `search`, `describe`, `invoke`, `invoke-async`, `invoke-status`, and `get-result`; fresh built fake-daemon calls mapped them to the exact six `gateway.*` tool names and exact representative argument objects. Every success was one compact stdout JSON line with empty stderr.
- Input and output contract: passed. Source and fresh tests cover strict positional/option parsing, duplicate/missing/unknown/trailing options, numeric bounds, inline and stdin plain-object JSON, secret-safe diagnostics, URL precedence/validation, compact stream separation, and stable exit codes `0/2/3/4/5`.
- JSON-RPC transport: passed. The client sends `tools/call`, increments IDs, unwraps the single MCP text result, and distinguishes connection, valid gateway, and malformed-response failures. Recovery is entered only for `DAEMON_UNAVAILABLE`, and the gateway call is retried at most once.
- Daemon recovery: passed. Recovery derives `/health`, short-circuits on health, tries systemd first, starts at most one detached fallback, uses at-most-100-ms polling, and applies one absolute five-second deadline to health, systemd, and sleep operations.
- Real timed-out child reaping: passed. The focused built-process regression used a real isolated fake `systemctl`, recorded its PID, ignored `SIGTERM`, and completed in 5.310 seconds after escalation; the CLI exited `3` with the exact compact `DAEMON_UNAVAILABLE` envelope and the recorded PID no longer existed. Source confirms settlement on child `close`, 100-ms `SIGTERM`→`SIGKILL` escalation, and timer/listener cleanup.
- Legacy compatibility: passed. Fresh full-suite built coverage executes no-argument/config-path stdio, `--daemon`, `--port`, `--discover`, all four migration modes, both help aliases, and rejection of unknown single-/double-dash options and malformed ports before stdio startup.
- Package and distribution: passed. Clean-source pack tests build via `prepack`, create/extract a real tarball, smoke the packed executable, and require all seven compiled `dist/cli/*.js` modules plus both skill artifacts. Independent dry-run inspection reported 137 files with every required artifact present.
- Agent skill and docs: passed. Official `quick_validate.py` returned `Skill is valid!`. The 374-word skill and agent docs accurately teach search → describe → invoke/async → status → selective top-level `_ref` retrieval, stdin for secrets, endpoint resolution, errors, and common mistakes. Recorded baseline and forward-test evidence covers the required fresh-agent gap and corrected workflow.
- Security/error/recovery boundaries: passed. Built and unit coverage verifies supplied JSON and credential-bearing endpoints are not echoed, remote gateway details are shielded, malformed responses do not trigger recovery, hanging health returns bounded exit `3`, late async failures are handled, and child/socket/process cleanup is bounded.

### Fresh verification

- `npm run build && npm test` — PASS, 118/118 tests.
- Focused real-child regression — PASS, 1/1; `elapsed=5310ms`, recorded systemctl PID absent after CLI completion.
- `quick_validate.py skills/using-goldeneye-cli` — `Skill is valid!`.
- `npm pack --dry-run --json --silent` — PASS, 137 files; `dist/index.js`, seven compiled CLI modules, `SKILL.md`, and `agents/openai.yaml` present.
- Fresh built six-command fake-daemon matrix — PASS; exact names/arguments, compact stdout, empty stderr for all six commands.
- `git diff --check e15f9e3^..HEAD` and current `git diff --check` — PASS.

No unmet specification requirement or fresh blocking gap was found. Pre-existing unrelated/untracked worktree files and generated `dist` changes were not altered by this review.

### Progression

- Spec review: checked
- Code quality: unchecked
- Integration review: unchecked
- Next action: run the plan-scoped code-quality review.

---

## Rerun 8 — 2026-08-11 14:53 CEST

Result: passed

Reviewed range: `e15f9e3^..9edd27d`, including quality repairs `240e0e0` and `65bd5a3`, all original design/plan/task/context artifacts, current source/tests/docs/skill/package metadata, and the existing generated distribution without relying on it for source-only test evidence.

### Quality-invalidated requirement closure

- Canonical `npm test` from source only: passed. An independent disposable fixture excluded `.git`, `node_modules`, and `dist`, linked only the repository dependencies, and ran exactly `npm test` without a preceding build. All 120 tests passed. `dist/` was absent before and after the command, proving the suite did not consume or dirty repository distribution output.
- Isolated built-executable tests: passed. `tests/helpers/built-cli.ts` compiles current `src/` into an OS-temp ESM fixture using an explicit temporary `--outDir`; `tests/cli-entrypoint.test.ts` uses that executable for every built process test, asserts the build root is outside the repository, and disposes the fixture after the suite. A post-suite process check found no surviving temporary CLI/systemd child; the only initial pattern match was the audit shell containing its own literal search expression and disappeared when that shell ended.
- Canonical systemd unit: passed. Commit `65bd5a3` renames the repository asset to `goldeneye-mcp-proxy.service`, matching runtime `SYSTEMD_SERVICE`, README installation/operation commands, and `package.json.files`. The clean package fixture copies and requires the unit, and the extracted-package test proves byte-for-byte equality with the repository asset.
- Package inclusion: passed. Fresh `npm pack --dry-run --json --silent` reported 138 files with `dist/index.js`, all seven compiled `dist/cli/*.js` modules, both bundled skill artifacts, and `goldeneye-mcp-proxy.service`; required missing count was zero.

### Complete requirement audit

- Six CLI commands and mappings: passed. Source and the 120-test suite cover exactly `search`, `describe`, `invoke`, `invoke-async`, `invoke-status`, and `get-result`, mapped to the exact six `gateway.*` tool names with documented option-to-argument shapes.
- Input/output/error contracts: passed. Strict positional/option parsing, duplicate/missing/unknown/trailing rejection, numeric bounds, inline/stdin plain-object JSON, secret-safe errors, URL precedence and validation, one compact output line on the correct stream, and exit codes `0/2/3/4/5` remain covered.
- JSON-RPC transport and recovery: passed. Calls use existing `POST /mcp` `tools/call`, unwrap one MCP text result, shield remote/malformed errors, recover only from connection failures, probe health, try the canonical user-systemd unit first, use at most one detached fallback, apply one absolute five-second deadline, reap an uncooperative real systemd child, and retry the request once at most.
- Legacy modes: passed. The fresh isolated built executable covers no-argument/config-path stdio, `--daemon`, `--port`, `--discover`, all migration modes, both help aliases, and rejects unknown single-/double-dash options and malformed ports before stdio startup.
- Skill/docs: passed. `quick_validate.py` returned `Skill is valid!`. The packaged skill teaches search → describe → invoke/async → status polling → selective top-level `_ref` retrieval, stdin for secrets, URL precedence, compact JSON/error codes, one complete example, and common mistakes. Task context retains baseline failure and skill-guided forward-test evidence. README and `AGENT-CONTEXT.md` align with the CLI and top-level truncation fields.
- Build and hygiene gates: `npm run build`, `git diff --check`, and `git diff --check e15f9e3^..HEAD` passed. Existing unrelated/untracked files and generated `dist` changes were not edited by this review.

No original requirement, prior blocker family, quality-invalidated integration requirement, or fresh specification gap remains unproven.

### Progression

- Spec review: checked
- Code quality: unchecked
- Integration review: unchecked
- Next action: rerun the plan-scoped code-quality review.

---

## Rerun 9 — 2026-08-11 15:17 CEST

Result: passed

Reviewed range: `e15f9e3^..c6a8688`, including the full implementation/repair history, original design and plan, all five task requirements and contexts, actual source/tests/docs/skill/package files, and current generated distribution only for build/package smoke evidence.

### Fresh blocker-family audit

- Packaged systemd unit: passed. `goldeneye-mcp-proxy.service` now has exactly one active, non-placeholder npm-first `ExecStart`, a PATH covering common npm/pnpm user locations, and the canonical config path. `systemd-analyze verify goldeneye-mcp-proxy.service` exited `0`; structural inspection reported `active_execstarts=1`. README and `SETUP_PROMPT.md` instruct source-clone users to replace that single line, never activate a second one.
- Source-only test independence: passed. A fresh disposable copy excluded `.git`, `node_modules`, and `dist`, linked only repository dependencies, then ran exactly `npm test` without a build. All `120/120` tests passed, and `dist/` was absent both before and after the command.
- Six-command gateway contract: passed. Actual parser/runner source recognizes only `search`, `describe`, `invoke`, `invoke-async`, `invoke-status`, and `get-result` and maps them to exact tool names `gateway.search`, `gateway.describe`, `gateway.invoke`, `gateway.invoke_async`, `gateway.invoke_status`, and `gateway.get_result`. Focused parser/client/runner verification passed `32/32`, including exact option-to-argument objects.
- Input, security, and error contract: passed. Actual code and tests cover strict missing/unknown/duplicate/trailing option rejection; positive numeric bounds; inline/stdin plain-object JSON; flag → environment → default URL precedence; absolute HTTP(S) endpoint validation; secret-safe diagnostics; one compact JSON line on the correct stream; and stable exits `0/2/3/4/5`.
- JSON-RPC and recovery contract: passed. The client sends `tools/call`, validates/unpacks the JSON-RPC and single MCP text envelopes, and shields malformed/remote failures. Recovery occurs only after connection failure, probes health, uses the canonical systemd service before one detached fallback, shares one five-second deadline, reaps a SIGTERM-ignoring systemd child via bounded SIGKILL escalation, and retries the request at most once.
- Legacy compatibility: passed. The isolated fresh build tests retain no-argument/config-path stdio, `--daemon`, `--port`, `--discover`, four migration modes, both help aliases, and pre-stdio rejection of malformed legacy options.
- Packaging and skill: passed. Fresh dry-run packaging reported `138` files and zero missing required artifacts: executable, all seven compiled CLI modules, both skill files, and the canonical service unit. The extracted package smoke is part of the passing suite. Official skill validation returned `Skill is valid!`; the 374-word skill teaches search → describe → invoke/async → status → selective top-level `_ref`, stdin secrets, error codes, and common mistakes.

### Fresh verification

- `npm test` — PASS, `120/120`.
- Source-only disposable-fixture `npm test` — PASS, `120/120`; no `dist/` created.
- `node --loader ts-node/esm --test tests/cli-parse.test.ts tests/cli-run.test.ts tests/cli-gateway-client.test.ts` — PASS, `32/32`.
- `npm run build` — PASS.
- `npm pack --dry-run --json --silent` — PASS, `138` files, required missing count `0`.
- `systemd-analyze verify goldeneye-mcp-proxy.service` — PASS; exactly one active `ExecStart`.
- `quick_validate.py skills/using-goldeneye-cli` — `Skill is valid!`; exactly two skill files.
- `git diff --check e15f9e3^..HEAD` and current `git diff --check` — PASS.

No missing, extra, misunderstood, regressed, stale-range, or unproven specification requirement was found. Generated `dist` changes, pre-existing unrelated files, and the separate untracked quality-review artifact were not edited by this review.

### Progression

- Spec review: checked
- Code quality: unchecked
- Integration review: unchecked
- Next action: rerun the plan-scoped code-quality review.
