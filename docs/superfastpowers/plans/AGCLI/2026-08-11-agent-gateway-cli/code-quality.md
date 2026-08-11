# Agent Gateway CLI Code Quality Review

Result: failed

Reviewed: 2026-08-11 14:33 CEST

## Scope

- Checked prerequisite: `spec-review.md` rerun 7 is `passed`; progression recorded `Spec review: checked` before this review.
- Reviewed range: `e15f9e3^..d1d1087`, all five task contexts, current source/tests/docs/skill/package manifest, committed distribution, and current generated distribution.
- Focus: correctness risk, process cleanup, error classification, secret handling, parser structure, maintainability, test reliability/side effects, packaging, documentation/skill quality, project fit, and unrelated changes.

## Findings

### Important 1: the canonical test command depends on uncommitted generated distribution

`package.json:27-31` defines `npm test` without a build step, while `tests/cli-entrypoint.test.ts:13` executes `dist/index.js`. At reviewed commit `d1d1087`, only the old tracked `dist/index.js` and map exist: there is no committed `dist/cli/`, and committed `dist/index.js` contains no `runCli`, `isGatewayCliCommand`, or gateway command dispatch. The current worktree passes because an earlier build left modified `dist/index.*` and untracked `dist/cli/` behind.

Independent clean-tree evidence used `git archive d1d1087`, symlinked the existing dependency directory, and ran exactly `npm test` without a preceding build. The first built-entrypoint tests timed out/failed; stale `--wat` dispatch entered stdio and left a child alive after the externally bounded test run. The reviewer terminated only that exact leaked process tree. In contrast, current generated-tree `npm test` passes 118/118.

This makes the advertised test suite order-dependent, permits stale built behavior to be tested, and can leak long-running children when a clean checkout runs the normal test command. Repair the test architecture so `npm test` from the committed source tree always tests a fresh build. Prefer an isolated temporary build/executable so tests do not dirty tracked `dist`; at minimum, prove the canonical command itself builds before built tests and cannot consume stale output. Add a clean-tree regression or CI-equivalent check.

### Important 2: the systemd-first recovery asset is named differently and is omitted from the package

Runtime recovery invokes `goldeneye-mcp-proxy.service` (`src/cli/daemon-startup.ts:6,81-84`), README installation says that file ships with the package (`README.md:338-353`), and `package.json:17-25` allowlists it. The repository contains only `goldeneye.service`. Fresh `npm pack --dry-run --json --silent` reported no service file, and `tests/cli-package.test.ts:14-24,50-58` neither copies nor asserts the service asset.

Thus a fresh npm user cannot follow the documented installation flow, and the new CLI's preferred systemd recovery cannot use the unit shipped by this project; it always falls through unless an independently created unit already exists. Align the actual filename, runtime constant, README commands, and package allowlist around one canonical unit name. Include the unit in the clean package fixture and assert it appears in the tarball. Smoke the installed unit name or otherwise prove the systemd-first path targets the packaged asset.

Because this finding exposes a behavioral/package integration gap in the checked specification result, reset spec review as well as quality.

## Quality Evidence

- Current generated-tree `npm test`: PASS, 118/118.
- Clean committed-tree `npm test`: FAIL/time out in built-entrypoint coverage because committed `dist` is stale and `dist/cli/` is absent.
- `git ls-tree -r d1d1087 dist/cli dist/index.js dist/index.js.map`: only `dist/index.js` and `dist/index.js.map`.
- `git grep` in committed `dist/index.js`: no `runCli`, `isGatewayCliCommand`, or `gateway.search`.
- `npm pack --dry-run --json --silent`: no service-unit file.
- `python .../quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`.
- `git diff --check e15f9e3^..d1d1087` and current `git diff --check`: PASS.
- Source review found focused modules, secret-safe validation/errors, bounded health/systemd cleanup, one-retry orchestration, strict parser behavior, and accurate CLI/skill workflow apart from the findings above.
- Pre-existing unrelated/untracked files and generated distribution changes were inspected but not modified by this review.

## Progression

- Spec review: unchecked
- Code quality: failed
- Integration review: unchecked
- Next action: repair both findings from `implementer-handoff.md`, then rerun plan-scoped spec review followed by code quality.

---

## Rerun — 2026-08-11 14:59 CEST

Result: failed

### Scope

- Prerequisite confirmed: `spec-review.md` rerun 8 passed and progression had `Spec review: checked` before this review.
- Reviewed range `e15f9e3^..9edd27d`, including quality repairs `240e0e0` and `65bd5a3`, all CLI source/tests, package metadata, README/agent context, bundled skill, canonical unit, task contexts, and current metadata.
- Rechecked correctness/process cleanup, transport/error classification, secret handling, parser/client boundaries, maintainability, test isolation/cleanup/flakiness, package/service alignment, docs/skill quality, and unrelated worktree changes.

### Prior quality finding closure

- Source-only canonical tests: resolved. A disposable archive of `9edd27d` explicitly excluded `dist/`, linked only existing dependencies, and ran exactly `npm test` without a build pre-step. All 120 tests passed; `dist/` was absent before and after.
- Fresh isolated executable: resolved. `tests/helpers/built-cli.ts` compiles current source under an OS-temp root, and every built-entrypoint test consumes that executable. The suite covers all legacy modes, six-command dispatch, validation/errors, hanging health, and real uncooperative-systemctl cleanup with bounded teardown.
- Canonical unit filename/package inclusion: resolved as far as naming and inclusion. Runtime, package allowlist, README, repository asset, and package tests all name `goldeneye-mcp-proxy.service`. A fresh source-only build and dry-run package reported 138 files with every CLI module, both skill artifacts, and the unit present.

### Important 1: the packaged systemd unit is not usable through the documented npm setup

The canonical filename repair ships the asset, but the asset still activates only a source-clone placeholder: `goldeneye-mcp-proxy.service:20` executes `/usr/bin/node /path/to/goldeneye-mcp-proxy/dist/index.js`. The recommended npm command is merely a commented example at line 13. README tells npm users to copy the unit, replace `/home/username/`, and “just uncomment the right line” (`README.md:340-358`); it does not tell them to remove/comment the already-active placeholder.

Independent reproduction copied the shipped unit, applied the documented home replacement, and uncommented the npm `ExecStart`. The resulting `Type=simple` service had two active `ExecStart` directives. `systemd-analyze verify` exited `1`: “Service has more than one ExecStart= setting, which is only allowed for Type=oneshot services. Refusing.” If the user does not uncomment the npm line, the active `/path/to/...` executable cannot start. Thus the preferred systemd-first recovery still cannot be installed successfully by following the npm instructions.

`tests/cli-package.test.ts:63-70,123-132` proves only filename/text alignment and byte inclusion; it never validates the shipped unit or simulates either documented installation mode. The rename test therefore permits a present but unusable service asset.

Repair with one unambiguous, valid default or generate separate valid templates. For the recommended npm flow, the copied unit should have exactly one active runnable `ExecStart`; source-clone customization must remain explicit. Update README steps accordingly. Add a package/default-unit regression that runs `systemd-analyze verify` when available (with a portable structural assertion otherwise) and proves the documented npm transformation leaves exactly one active command. Also retain runtime/package filename alignment and extracted-package equality.

Because this is a behavioral package/recovery integration gap, specification status is reset for re-review.

### Quality evidence

- Source-only `npm test`, with `dist/` absent before/after: PASS, 120/120.
- Fresh source-only `npm run build`: PASS.
- Fresh `npm pack --dry-run --json --silent`: PASS, 138 files, zero required CLI/skill/unit artifacts missing.
- `quick_validate.py skills/using-goldeneye-cli`: `Skill is valid!`.
- Shipped-unit npm-flow simulation plus `systemd-analyze verify`: FAIL, exit `1`, duplicate `ExecStart` for `Type=simple`.
- `git diff --check` and `git diff --check e15f9e3^..9edd27d`: PASS.
- Source review otherwise found focused parser/client/recovery modules, secret-safe generic diagnostics, correct recovery-only connection classification, bounded child/socket cleanup, strict mapping/validation, isolated package/build tests, and accurate agent workflow guidance.
- Existing unrelated/untracked files, generated `dist` changes, and pre-existing AGCLI metadata dirt were not changed except the required review/progression/handoff artifacts.

### Progression

- Spec review: unchecked
- Code quality: failed
- Integration review: unchecked
- Next action: repair the shipped unit/default npm installation flow from `implementer-handoff.md`, then rerun plan-scoped spec review and code quality.

---

## Rerun 3 — 2026-08-11 15:23 CEST

Result: checked

### Scope

- Prerequisite confirmed: `spec-review.md` rerun 9 passed at commit `6d0e001`; progression recorded `Spec review: checked` before this review.
- Reviewed range: `e15f9e3^..6d0e001`, including the full CLI implementation and repair history, all five task contexts, actual source/tests/docs/skill/package assets, and current generated distribution only as build/package output.
- Rechecked correctness, process and listener cleanup, async deadlines, transport/error classification, parser boundaries, secret handling, maintainability, test isolation and teardown, package/service usability, documentation accuracy, project fit, and unrelated worktree changes.

### Findings

No Critical, Important, or Minor quality finding remains.

### Prior finding closure

- Source-only test independence remains resolved. Built-process tests compile current `src/` into an OS-temp fixture and dispose it after the suite; the canonical `npm test` no longer depends on repository `dist/` state.
- Runtime/package/service naming remains aligned on `goldeneye-mcp-proxy.service`. The package tests copy and extract the canonical asset and compare it byte-for-byte.
- The shipped unit is now usable by default: exactly one active npm-first `ExecStart`, no placeholder path, common npm/pnpm user paths, and a valid source-clone single-line replacement flow. Fresh `systemd-analyze verify` passed.

### Quality evidence

- `npm test` — PASS, `120/120`; no failed, cancelled, skipped, or todo tests.
- `npm run build` — PASS.
- `npm pack --dry-run --json --silent` — PASS, `138` files, including the executable, seven compiled CLI modules, both bundled skill artifacts, and `goldeneye-mcp-proxy.service`.
- `systemd-analyze verify goldeneye-mcp-proxy.service` — PASS.
- `quick_validate.py skills/using-goldeneye-cli` — `Skill is valid!`.
- `git diff --check e15f9e3^..HEAD` and current `git diff --check` — PASS.
- Source inspection found focused CLI modules, strict and secret-safe parsing, one-retry recovery only for connection failure, a shared absolute recovery deadline, bounded SIGTERM-to-SIGKILL systemd-child cleanup, generic remote/internal errors, and compact stream-safe output.
- Tests exercise actual isolated built processes, a real uncooperative `systemctl`, hanging sockets, all six exact gateway mappings, legacy dispatch, source-only packing, extracted-package execution, and fixture cleanup. No stale-build dependency or obvious nondeterministic shared state remains.
- Existing unrelated/untracked files and generated `dist` changes were inspected but not modified by this review.

### Progression

- Spec review: checked
- Code quality: checked
- Integration review: unchecked
- Next action: run the final plan-scoped integration review.
