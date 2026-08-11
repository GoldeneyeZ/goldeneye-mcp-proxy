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
