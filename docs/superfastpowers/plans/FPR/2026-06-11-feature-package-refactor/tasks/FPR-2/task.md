## Task 2: Move Low-Risk Files Into Feature Packages

<TASK-ID>FPR-2</TASK-ID>

**Files:**
- Move: `src/types.ts` -> `src/shared/types.ts`
- Move: `src/config.ts` -> `src/config/Config.ts`
- Move: `src/lazy-config.ts` -> `src/config/lazy-config.ts`
- Move: `src/catalog-snapshot.ts` -> `src/catalog/CatalogSnapshotManager.ts`
- Move: `src/jobs.ts` -> `src/jobs/JobManager.ts`
- Move: `src/search.ts` -> `src/search/SearchEngine.ts`
- Move: `src/projectRegistry.ts` -> `src/projects/ProjectRegistry.ts`
- Move: `src/connection-state.ts` -> `src/upstreams/connection-state.ts`
- Move: `src/resource-monitor.ts` -> `src/upstreams/resource-monitor.ts`
- Modify: `src/index.ts`, `src/gateway.ts`, `src/http-server.ts`, `src/handlers.ts`, `src/connections.ts`, moved files' imports

- [ ] **Step 1: Run baseline checks**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with the JSON-RPC tests from FPR-1.

- [ ] **Step 2: Move files**

Run these file moves:

```bash
mkdir -p src/shared src/config src/catalog src/jobs src/search src/projects src/upstreams
git mv src/types.ts src/shared/types.ts
git mv src/config.ts src/config/Config.ts
git mv src/lazy-config.ts src/config/lazy-config.ts
git mv src/catalog-snapshot.ts src/catalog/CatalogSnapshotManager.ts
git mv src/jobs.ts src/jobs/JobManager.ts
git mv src/search.ts src/search/SearchEngine.ts
git mv src/projectRegistry.ts src/projects/ProjectRegistry.ts
git mv src/connection-state.ts src/upstreams/connection-state.ts
git mv src/resource-monitor.ts src/upstreams/resource-monitor.ts
```

- [ ] **Step 3: Update imports**

Use these import mappings:

```text
./types.js -> ./shared/types.js or ../shared/types.js
./config.js -> ./config/Config.js or ../config/Config.js
./lazy-config.js -> ./config/lazy-config.js or ../config/lazy-config.js
./catalog-snapshot.js -> ./catalog/CatalogSnapshotManager.js or ../catalog/CatalogSnapshotManager.js
./jobs.js -> ./jobs/JobManager.js or ../jobs/JobManager.js
./search.js -> ./search/SearchEngine.js or ../search/SearchEngine.js
./projectRegistry.js -> ./projects/ProjectRegistry.js or ../projects/ProjectRegistry.js
./connection-state.js -> ./upstreams/connection-state.js or ../upstreams/connection-state.js
./resource-monitor.js -> ./upstreams/resource-monitor.js or ../upstreams/resource-monitor.js
```

For files now inside feature directories, import shared types with `../shared/types.js`.

- [ ] **Step 4: Run verification**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm run build`

Expected: PASS and `dist/index.js` exists.

Run: `npm test`

Expected: PASS with all tests.

- [ ] **Step 5: Commit**

```bash
git add src package.json tests
git commit -m "refactor: move core files into feature packages"
```
