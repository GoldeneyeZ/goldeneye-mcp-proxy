# Context for GSD-3

**Plan:** `docs/superfastpowers/plans/GSD/2026-06-13-global-skill-deferral.md`
**Task:** `GSD-3`
**Commit SHA:** `b557199`. If review fixes add commits, update to the latest task commit and note the reviewed range below.

## Starting Context

- `src/skills/SkillResourcePolicy.ts`: new file planned for Resource Policy And Resource Maps.
- `tests/skill-resource-policy.test.ts`: test coverage planned for Resource Policy And Resource Maps.

## Open Context Rule

The files above are starting points only. Inspect any additional files needed to complete the task correctly.

## Completion Updates

Implemented skill resource map generation and guarded support-file reads.

Files created:
- `src/skills/SkillResourcePolicy.ts`
- `tests/skill-resource-policy.test.ts`

Files modified:
- None.

Additional relevant files:
- `dist/` changed from `npm run build`; generated output intentionally left for
  the final build artifact task.

Verification:
- `node --loader ts-node/esm --test tests/skill-resource-policy.test.ts`:
  PASS.
- `npm test -- tests/skill-resource-policy.test.ts`: PASS. Note: current package
  script also runs `tests/**/*.test.ts`, so existing tests ran in the same
  command.
- `npm run build`: PASS.
