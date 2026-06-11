## Task 9: Final Cleanup And Compatibility Check

<TASK-ID>FPR-9</TASK-ID>

**Files:**
- Modify: `src/index.ts`
- Delete: stale root files left after compatibility period
- Modify: `README.md` only if command names or documented file paths changed

- [ ] **Step 1: Find stale root files**

Run:

```bash
find src -maxdepth 1 -type f -name '*.ts' -print | sort
```

Expected remaining root file list:

```text
src/index.ts
```

If compatibility wrappers remain, remove them after updating imports that reference them.

- [ ] **Step 2: Search for old import paths**

Run:

```bash
rg -n "\"\\./(gateway|http-server|handlers|connections|response-store|search|jobs|types|config|lazy-config|catalog-snapshot|projectRegistry|resource-monitor|connection-state)\\.js\"|\"\\.\\./(gateway|http-server|handlers|connections|response-store|search|jobs|types|config|lazy-config|catalog-snapshot|projectRegistry|resource-monitor|connection-state)\\.js\"" src tests
```

Expected: no matches.

- [ ] **Step 3: Run full verification**

Run: `npm test`

Expected: PASS with all tests.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm run build`

Expected: PASS and `dist/index.js` exists.

Run: `node dist/index.js --help`

Expected: prints usage text and exits without starting a daemon.

- [ ] **Step 4: Check working tree and public package metadata**

Run: `git status --short`

Expected: only intended cleanup files are modified.

Run:

```bash
node -e "const p=require('./package.json'); console.log(p.bin['goldeneye-mcp-proxy'], p.exports['.'].import, p.types)"
```

Expected output:

```text
dist/index.js ./dist/index.js ./dist/index.d.ts
```

- [ ] **Step 5: Commit**

```bash
git add src tests package.json README.md
git commit -m "refactor: finalize feature package layout"
```
