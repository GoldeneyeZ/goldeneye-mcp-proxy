# Context for GSD-6

**Plan:** `docs/superfastpowers/plans/GSD/2026-06-13-global-skill-deferral.md`
**Task:** `GSD-6`
**Commit SHA:** `97b98bb`. If review fixes add commits, update to the latest task commit and note the reviewed range below.

## Starting Context

- `src/skills/SkillMigrationService.ts`: new file planned for Codex Skill Migration CLI.
- `src/index.ts`: existing file expected to be updated for Codex Skill Migration CLI.
- `tests/skill-migration-service.test.ts`: test coverage planned for Codex Skill Migration CLI.

## Open Context Rule

The files above are starting points only. Inspect any additional files needed to complete the task correctly.

## Completion Updates

Implemented explicit Codex global skill migration/restore service and CLI flags.

Files created:
- `src/skills/SkillMigrationService.ts`
- `tests/skill-migration-service.test.ts`

Files modified:
- `src/index.ts`

Additional relevant files:
- `dist/` changed from `npm run build`; generated output intentionally left for
  the final build artifact task.

Verification:
- `npm test -- tests/skill-migration-service.test.ts`: PASS.
- `npm run build`: PASS.
