### Task 8: Final Verification

<TASK-ID>GSD-8</TASK-ID>

**Files:**
- Modify only if verification exposes a real issue.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: PASS for all `tests/**/*.test.ts`.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS and updated `dist/` files are generated.

- [ ] **Step 3: Verify HTTP tool listing includes both gateways**

Run this one-off command after build:

```bash
node -e "import('./dist/transports/http/request-router.js').then(async ({HttpMcpRequestRouter}) => { const gateway={search:()=>({}),describe:()=>({}),invoke:async()=>({}),invokeAsync:()=>({}),invokeStatus:()=>({}),getResult:()=>({})}; const skills={search:()=>({}),pull:()=>({}),readResource:()=>({}),status:()=>({})}; const r=new HttpMcpRequestRouter(gateway, skills); const res=await r.route({jsonrpc:'2.0',id:1,method:'tools/list'}); const names=res.result.tools.map(t=>t.name); console.log(names.filter(n=>n.startsWith('skills.')).join(',')); })"
```

Expected output contains:

```text
skills.search,skills.pull,skills.read_resource,skills.status
```

- [ ] **Step 4: Review git status**

Run: `git status --short`

Expected: only intended source, test, docs, and generated `dist/` files are modified. Existing unrelated user changes, such as a pre-existing modified `README.md` or untracked exploratory tests, must not be reverted.

- [ ] **Step 5: Commit build artifacts if this repo tracks `dist/`**

If `npm run build` modified `dist/`, commit those generated files:

```bash
git add dist
git commit -m "build: update generated skill gateway output"
```

If `dist/` did not change, skip this commit.
