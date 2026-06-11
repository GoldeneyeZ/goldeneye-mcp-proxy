## Task 8: Move Gateway And Upstream Internals

<TASK-ID>FPR-8</TASK-ID>

**Files:**
- Move/Modify: `src/gateway.ts` -> `src/gateway/MCPGateway.ts`
- Move/Modify: `src/connections.ts` -> `src/upstreams/ConnectionManager.ts`
- Create: `src/upstreams/environment.ts`
- Modify: `src/index.ts`
- Modify: imports across `src`

- [ ] **Step 1: Move gateway and connection facade files**

Run:

```bash
git mv src/gateway.ts src/gateway/MCPGateway.ts
git mv src/connections.ts src/upstreams/ConnectionManager.ts
```

- [ ] **Step 2: Extract environment parser**

Create `src/upstreams/environment.ts` with the existing `parseEnvironmentVariables` body from `src/connections.ts:30-44`:

```ts
export function parseEnvironmentVariables(env?: Record<string, string>): Record<string, string> | undefined {
  if (!env) return undefined;

  const parsed: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    parsed[key] = value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => process.env[varName] || "");
  }
  return parsed;
}
```

In `src/upstreams/ConnectionManager.ts`, remove the local `parseEnvironmentVariables` function and import it:

```ts
import { parseEnvironmentVariables } from "./environment.js";
```

- [ ] **Step 3: Update public imports and exports**

In `src/index.ts`, import from feature packages:

```ts
import { MCPGateway } from "./gateway/MCPGateway.js";
import { HttpMcpServer } from "./transports/http/HttpMcpServer.js";
```

Keep the public export:

```ts
export { MCPGateway, HttpMcpServer };
```

In `src/gateway/MCPGateway.ts`, update imports to feature package paths:

```ts
import { CatalogSnapshotManager } from "../catalog/CatalogSnapshotManager.js";
import { Config } from "../config/Config.js";
import { normalizeLazyConfig } from "../config/lazy-config.js";
import { JobManager } from "../jobs/JobManager.js";
import { ProjectRegistry } from "../projects/ProjectRegistry.js";
import { ResponseShield } from "../responses/ResponseShield.js";
import { ResponseStore } from "../responses/ResponseStore.js";
import { SearchEngine } from "../search/SearchEngine.js";
import type { GatewayConfig } from "../shared/types.js";
import { createServer } from "../tools/stdio-tool-registration.js";
import { GatewayToolService } from "../tools/GatewayToolService.js";
import { ConnectionManager } from "../upstreams/ConnectionManager.js";
import { ResourceMonitor } from "../upstreams/resource-monitor.js";
```

- [ ] **Step 4: Run verification**

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with all tests.

Run: `npm run build`

Expected: PASS and `dist/index.js` still exists.

- [ ] **Step 5: Commit**

```bash
git add src tests package.json
git commit -m "refactor: move gateway and upstream internals"
```
