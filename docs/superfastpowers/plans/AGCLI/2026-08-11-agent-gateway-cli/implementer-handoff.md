# Agent Gateway CLI Implementer Handoff

Source phase: plan-scoped spec review

## Required Repairs

### 1. Make clean package creation include the built CLI

Files:

- `package.json:27-32`
- `tests/cli-package.test.ts:8-18`
- generated `dist/index.*` and `dist/cli/*`, depending on the repository's chosen distribution policy

Fix the package lifecycle or tracked distribution so `npm pack --dry-run --json` from a clean checkout does not depend on pre-existing uncommitted build output. Extend the package test beyond skill-file presence.

Acceptance criteria:

- From a clean checkout of the repaired range, install dependencies and run `npm pack --dry-run --json` without a prior manual build.
- The report contains `dist/index.js`, every compiled `dist/cli/*.js` module, `skills/using-goldeneye-cli/SKILL.md`, and `skills/using-goldeneye-cli/agents/openai.yaml`.
- The packed executable's `--help` lists all six gateway subcommands, and a packed/extracted executable can dispatch a fake-daemon `search` call successfully.
- Automated package coverage fails when `dist/cli/` is absent or `dist/index.js` is stale.

### 2. Add built-executable regression coverage for legacy modes

File: `tests/cli-entrypoint.test.ts:16-91`

Add process-level tests proving the existing no-argument/config-path stdio path and the `--daemon`, `--port`, `--discover`, and skill-migration dispatches remain reachable and are not mistaken for gateway subcommands. Use bounded child processes, disposable configuration, and explicit teardown where a mode is long-running.

Acceptance criteria:

- Tests exercise the built `dist/index.js`, not only parser functions or static help text.
- Each legacy mode is distinguished by observable startup/dispatch behavior.
- Child processes are bounded and cleaned up.
- Existing new-command stdout/stderr and exit-code tests remain green.

### 3. Correct the `_ref` documentation contract

File: `AGENT-CONTEXT.md:228-233`

Replace the stale `metadata.ref` example with the actual top-level `_ref`/`_truncated` shape and keep `get-result` keyed from that returned `_ref`.

Acceptance criteria:

- The example agrees with `GatewayToolService.withTruncationMetadata` and the bundled skill.
- No agent-facing CLI example identifies `metadata.ref` as the pagination reference.

## Re-review Gates

- `npm test`
- `npm run build`
- skill `quick_validate.py`
- clean-checkout `npm pack --dry-run --json`
- built fake-daemon calls for all six commands
- bounded connection-refusal/auto-start check
- `git diff --check`

After repair, reset spec review to `unchecked` and rerun plan-scoped spec review. Keep code quality and integration review unchecked until spec review passes.

## Resolved Record

Resolved: 2026-08-11 12:59 CEST

- Finding 1: commit `b4e7dfb` adds `prepack` compilation plus clean-source dry-run and packed/extracted executable coverage. The tests require `dist/index.js`, every source-derived `dist/cli/*.js` module, both skill files, all six help entries, and successful fake-daemon `search` dispatch.
- Finding 2: commits `14d7c79` and `0f0a63d` add and record bounded built-executable legacy-mode regression coverage.
- Finding 3: commit `b4e7dfb` replaces `metadata.ref` with top-level `_ref` and `_truncated`; no agent-facing CLI example retains `metadata.ref`.
- Repair verification: focused package tests 2/2, full suite 106/106, TypeScript build, skill validation, and `git diff --check` pass.
- State reset for re-review: task `AGCLI-5` implemented; goal implementation checked; spec review unchecked; code quality and integration unchecked.
