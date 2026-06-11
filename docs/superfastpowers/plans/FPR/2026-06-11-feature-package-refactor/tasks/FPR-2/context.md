# Context for FPR-2

**Plan:** `docs/superfastpowers/plans/FPR/2026-06-11-feature-package-refactor.md`
**Task:** `FPR-2`
**Commit SHA:** Pending until task completion. If review fixes add commits, update to the latest task commit and note the reviewed range below.

## Starting Context

- `src/types.ts`: Starting point from task file entry: Move: `src/types.ts` -> `src/shared/types.ts`
- `src/config.ts`: Starting point from task file entry: Move: `src/config.ts` -> `src/config/Config.ts`
- `src/lazy-config.ts`: Starting point from task file entry: Move: `src/lazy-config.ts` -> `src/config/lazy-config.ts`
- `src/catalog-snapshot.ts`: Starting point from task file entry: Move: `src/catalog-snapshot.ts` -> `src/catalog/CatalogSnapshotManager.ts`
- `src/jobs.ts`: Starting point from task file entry: Move: `src/jobs.ts` -> `src/jobs/JobManager.ts`
- `src/search.ts`: Starting point from task file entry: Move: `src/search.ts` -> `src/search/SearchEngine.ts`
- `src/projectRegistry.ts`: Starting point from task file entry: Move: `src/projectRegistry.ts` -> `src/projects/ProjectRegistry.ts`
- `src/connection-state.ts`: Starting point from task file entry: Move: `src/connection-state.ts` -> `src/upstreams/connection-state.ts`
- `src/resource-monitor.ts`: Starting point from task file entry: Move: `src/resource-monitor.ts` -> `src/upstreams/resource-monitor.ts`
- `src/index.ts`: Starting point from task file entry: Modify: `src/index.ts`, `src/gateway.ts`, `src/http-server.ts`, `src/handlers.ts`, `src/connections.ts`, moved files' imports

## Open Context Rule

The files above are starting points only. Inspect any additional files needed to complete the task correctly.

## Completion Updates

The implementer updates this section before review with the final task commit SHA, reviewed commit range if relevant, files created, files modified, additional relevant files, and verification commands/results.
