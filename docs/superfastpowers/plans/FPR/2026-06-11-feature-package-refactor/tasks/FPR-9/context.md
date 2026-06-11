# Context for FPR-9

**Plan:** `docs/superfastpowers/plans/FPR/2026-06-11-feature-package-refactor.md`
**Task:** `FPR-9`
**Commit SHA:** `2143511` for implementation. Metadata update is recorded separately after the implementation commit.

## Starting Context

- `src/index.ts`: Starting point from task file entry: Modify: `src/index.ts`
- `Delete: stale root files left after compatibility period`: Starting point from task file entry: Delete: stale root files left after compatibility period
- `README.md`: Starting point from task file entry: Modify: `README.md` only if command names or documented file paths changed

## Open Context Rule

The files above are starting points only. Inspect any additional files needed to complete the task correctly.

## Completion Updates

Implemented FPR-9.

Files modified:
- `src/index.ts`
- `src/gateway/MCPGateway.ts`
- `src/upstreams/ConnectionManager.ts`
- Generated matching `dist/` files.

Files renamed:
- `src/upstreams/connection-state.ts` -> `src/upstreams/ConnectionState.ts`
- `src/upstreams/resource-monitor.ts` -> `src/upstreams/ResourceMonitor.ts`
- Generated matching `dist/upstreams/` files.

Files removed:
- Stale generated lower-case upstream helper files under `dist/upstreams/`.

Verification commands/results:
- `find src -maxdepth 1 -type f -name '*.ts' -print | sort`: PASS, output only `src/index.ts`.
- Stale import path `rg` from task: PASS with no matches after final cleanup.
- `./node_modules/.bin/tsc --noEmit`: PASS.
- `npm test`: PASS.
- `npm run build`: PASS.
- `test -f dist/index.js`: PASS.
- `node dist/index.js --help`: PASS, prints usage and exits 0 without starting stdio or daemon mode.
- `node -e "const p=require('./package.json'); console.log(p.bin['goldeneye-mcp-proxy'], p.exports['.'].import, p.types)"`: PASS, output `dist/index.js ./dist/index.js ./dist/index.d.ts`.

Implementation notes:
- Added `--help` and `-h` handling in `src/index.ts`.
- Renamed remaining upstream helper modules away from old lower-case compatibility-style import names so the final stale-path search is clean.
- README did not need updates because command names did not change.
