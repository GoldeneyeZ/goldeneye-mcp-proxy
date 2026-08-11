# Agent Gateway CLI Implementer Handoff

Resolved: 2026-08-11 13:33 CEST

- Endpoint finding resolved by `769d8d3`: final flag → `MCP_GATEWAY_URL` → default resolution is validated before argument input, transport, and recovery.
- Validator accepts only absolute credential-free `http:`/`https:` endpoints usable by `fetch`; malformed, unsupported, and credential-bearing endpoints return secret-safe `INVALID_ARGS`, exit `2`, empty stdout, and one compact stderr line.
- Injected runner tests prove `call` and `ensureDaemon` counts remain zero for invalid flag and environment endpoints. Built regressions cover malformed and unsupported values from both sources without leaking credentials, paths, hosts, or query values.
- Valid precedence remains covered with HTTPS flag, HTTP environment, and localhost default endpoints.
- TDD evidence: runner regressions failed `0 !== 2`; credential-bearing regressions failed `0 !== 2`; stale built executable returned exit `5`/`INTERNAL_ERROR`. Focused green: runner 9/9 and built endpoint regression 1/1.
- Fresh verification: TypeScript build PASS; full suite 113/113; clean-source package/extracted executable tests PASS; skill validation PASS; dry-run pack 137 files with required CLI/skill artifacts; `git diff --check` PASS.
- Prior five findings remain closed by `b4e7dfb`, `14d7c79`, `0f0a63d`, `a5c91fa`, and `2e87802`.
- State reset for re-review: all tasks implemented; goal implementation checked; spec review unchecked; code quality and integration unchecked.

---

## Rerun 4 Repair Required — 2026-08-11 13:38 CEST

### 1. Reject unknown single-dash top-level options

- Update top-level legacy validation in `src/index.ts` so unknown option-shaped tokens beginning with `-` fail before `runLegacyMode`; preserve the documented `-h` alias and all valid legacy/config paths.
- Return one compact secret-safe `INVALID_ARGS` envelope on stderr, exit `2`, empty stdout, and never initialize stdio.
- Add built-process regression coverage for at least `-wat`; prove no ready marker or stdio startup output. Include `-h` preservation.

Acceptance: built `-wat` exits `2` promptly with compact JSON and no echoed uncontrolled token; built `-h` still prints help and exits `0`; all existing legacy and CLI tests remain green.

### 2. Remove the stale metadata-ref claim

- Correct `AGENT-CONTEXT.md:158-160` to state that shielding adds top-level `_ref`, `_truncated`, and `_note`; do not claim `metadata.ref` or metadata `ref` exists.
- Check all CLI/agent-facing docs and the bundled skill for contradictory ref-location wording.

Acceptance: documentation consistently identifies top-level `_ref`; `rg` finds no claim that truncation `ref` lives in metadata; README and skill examples remain accurate.

After repair: rerun build, full tests, skill validation, clean package inspection, built legacy regressions, and plan-scoped spec review. Keep code quality and integration unchecked until spec review passes.

---

## Rerun 4 Implementation Repairs Resolved — 2026-08-11 13:50 CEST

- Finding 1 resolved by `20750e5`: unknown single-dash options fail before stdio; `-h` remains supported. AGCLI-4 context records focused evidence.
- Finding 2 resolved by `5319b69`: agent context now identifies `_ref`, `_truncated`, and `_note` as top-level shielding fields and limits `metadata` to request/tool/timing details.
- New package doc-contract test scans `AGENT-CONTEXT.md`, README, and bundled skill for metadata-ref claims; focused RED reproduced stale wording, GREEN passes.
- README and bundled skill required no edits: both already use top-level `_ref`; skill remains valid at 374 words.
- Fresh verification: TypeScript build PASS; full suite 114/114; package tests 3/3; clean dry-run pack 137 files with entrypoint, 21 CLI modules, skill, and skill metadata; `git diff --check` PASS.
- State reset for re-review: all tasks implemented; goal implementation checked; spec review unchecked; code quality and integration unchecked.

---

## Rerun 5 Repair Required — 2026-08-11 13:59 CEST

### Bound every daemon-recovery operation by the recovery deadline

- `src/cli/daemon-startup.ts:30-38,54-66`: the deadline currently bounds sleeps/loop checks only. Initial and repeated health probes use unbounded `fetch`; the systemd call uses unbounded `execFile`. A never-resolving operation prevents timeout exit indefinitely.
- Apply the one recovery deadline to every health and systemd await. Default health must abort its fetch when remaining time expires. Default systemd execution must be terminated/settled when remaining time expires. Injected operations also need a deterministic deadline race so tests cannot hang.
- Preserve existing behavior: initial health short-circuit; systemd before detached fallback; at most one detached fallback; poll sleeps no longer than 100 ms or remaining budget; false on deadline; one gateway retry only after `DAEMON_UNAVAILABLE`.
- Avoid unhandled late rejections from timed-out dependency promises and clean up timers/abort resources.

### Required regressions and acceptance

- Add daemon unit tests where health never settles and where systemd never settles. Each must return `false` within the injected deadline and must not perform out-of-order or repeated starts.
- Add a default-dependency or built-process regression with a loopback health handler that accepts but never responds; prove bounded completion, no hanging child, stable exit `3` envelope where exercised, and bounded teardown.
- Re-run `npm run build`, full `npm test`, skill validation, clean package/extracted smoke, all-six built command mapping, legacy modes (including `-wat` and `-h`), error/security checks, and `git diff --check`.
- After repair: set spec review to `unchecked`, keep quality/integration `unchecked`, and rerun plan-scoped spec review.

---

## Rerun 5 Implementation Repair Resolved — 2026-08-11 14:08 CEST

- Finding resolved by `e6cc6d8`: one absolute recovery deadline races every health, systemd, and sleep await.
- Default health uses the deadline abort signal for `fetch`; default systemd kills `systemctl` with `SIGTERM` and settles on abort. Timers/listeners are cleaned after settlement; late dependency rejection remains handled.
- Required injected regressions return `false` around 30-35 ms for never-settling health/systemd, preserve `health -> systemd` ordering, and perform no detached start after the deadline.
- Required built loopback regression drops `/mcp`, accepts `/health` without responding, then exits `3` in 5.21-5.48 seconds with empty stdout and one compact `DAEMON_UNAVAILABLE` line; child/server teardown is bounded.
- Preserved behavior remains green: initial health short-circuit, systemd before one detached fallback, 100 ms/remaining-budget polling, false at deadline, and one gateway retry only after `DAEMON_UNAVAILABLE`.
- Fresh verification: build PASS; full suite 117/117; skill valid; clean-source package/extracted smoke PASS; dry-run package 137 files/0 required missing; manual all-six built mapping PASS; legacy/error/security tests PASS; diff check PASS.
- State reset for re-review: all tasks implemented; goal implementation checked; spec review unchecked; code quality and integration unchecked.
