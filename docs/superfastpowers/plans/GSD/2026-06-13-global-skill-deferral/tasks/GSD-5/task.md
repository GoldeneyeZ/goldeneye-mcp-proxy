### Task 5: Register Skills Tools In Stdio And HTTP

<TASK-ID>GSD-5</TASK-ID>

**Files:**
- Create: `src/tools/skill-tool-schemas.ts`
- Modify: `src/tools/stdio-tool-registration.ts`
- Modify: `src/transports/http/request-router.ts`
- Modify: `src/transports/http/HttpMcpServer.ts`
- Modify: `src/gateway/MCPGateway.ts`
- Test: `tests/skill-tools-router.test.ts`

- [ ] **Step 1: Write failing HTTP router tests**

Create `tests/skill-tools-router.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { HttpMcpRequestRouter } from "../src/transports/http/request-router.js";

const gatewayService = {
  search: () => ({ found: 0, results: [] }),
  describe: () => ({}),
  invoke: async () => ({}),
  invokeAsync: () => ({}),
  invokeStatus: () => ({}),
  getResult: () => ({}),
};

const skillService = {
  search: () => ({ query: "review", found: 1, results: [{ id: "codex-deferred::review" }] }),
  pull: () => ({ id: "codex-deferred::review", content: "# Review", resources: [] }),
  readResource: () => ({ path: "references/guide.md", content: "# Guide\n", size: 8 }),
  status: () => ({ skillCount: 1 }),
};

test("tools/list includes skills tools separately from gateway tools", async () => {
  const router = new HttpMcpRequestRouter(gatewayService as never, skillService as never);

  const response = await router.route({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const names = (response?.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);

  assert.ok(names.includes("gateway.search"));
  assert.ok(names.includes("skills.search"));
  assert.ok(names.includes("skills.pull"));
  assert.ok(names.includes("skills.read_resource"));
  assert.ok(names.includes("skills.status"));
});

test("tools/call routes skills.search", async () => {
  const router = new HttpMcpRequestRouter(gatewayService as never, skillService as never);

  const response = await router.route({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "skills.search", arguments: { query: "review" } },
  });

  const content = (response?.result as { content: Array<{ text: string }> }).content[0].text;
  assert.match(content, /codex-deferred::review/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/skill-tools-router.test.ts`

Expected: FAIL because `HttpMcpRequestRouter` does not accept a skill service and does not list `skills.*` tools.

- [ ] **Step 3: Add skill tool schemas**

Create `src/tools/skill-tool-schemas.ts`:

```ts
import type { ToolSchema } from "./gateway-tool-schemas.js";

export const SKILL_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "skills.search",
    description: "Search global deferred skills. Returns compact metadata only, never full SKILL.md content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results to return (default 10, max 50)" },
      },
    },
  },
  {
    name: "skills.pull",
    description: "Return one full SKILL.md by id, plus metadata and a bounded resource map.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID from skills.search" },
      },
      required: ["id"],
    },
  },
  {
    name: "skills.read_resource",
    description: "Read one support file for a pulled skill by relative path.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID from skills.search" },
        path: { type: "string", description: "Relative resource path from skills.pull resources" },
      },
      required: ["id", "path"],
    },
  },
  {
    name: "skills.status",
    description: "Report indexed skill roots, skill counts, invalid skills, and Codex skill migration status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];
```

- [ ] **Step 4: Wire skill services in `MCPGateway`**

Modify `src/gateway/MCPGateway.ts` imports:

```ts
import { resolveSkillConfig } from "../config/skill-config.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";
import { SkillSearchEngine } from "../skills/SkillSearchEngine.js";
import { SkillResourcePolicy } from "../skills/SkillResourcePolicy.js";
import { SkillGatewayService } from "../skills/SkillGatewayService.js";
import { isUpstreamConfig } from "../shared/types.js";
import { homedir } from "node:os";
import { join } from "node:path";
```

Add fields:

```ts
private skillRegistry: SkillRegistry;
private skillSearchEngine: SkillSearchEngine;
private skillResourcePolicy: SkillResourcePolicy;
private skillService: SkillGatewayService;
```

Initialize after `this.toolService` setup:

```ts
const skillConfig = resolveSkillConfig(this.config.getAll());
this.skillRegistry = new SkillRegistry(skillConfig);
this.skillSearchEngine = new SkillSearchEngine();
this.skillResourcePolicy = new SkillResourcePolicy({
  maxResourceBytes: skillConfig.maxResourceBytes,
  maxResourceEntries: skillConfig.maxResourceEntries,
});
this.skillService = new SkillGatewayService({
  registry: this.skillRegistry,
  searchEngine: this.skillSearchEngine,
  resourcePolicy: this.skillResourcePolicy,
  migrationPaths: {
    codexSkillsPath: join(homedir(), ".codex", "skills"),
    deferredPath: join(homedir(), ".codex", "skills.deferred"),
  },
});
this.skillService.refresh();
```

Pass it to `createServer`:

```ts
this.server = createServer(this.toolService, statusHolder, this.skillService);
```

In `connectAll`, skip reserved config entries:

```ts
for (const [serverKey, config] of Object.entries(allConfig)) {
  if (!isUpstreamConfig(config)) continue;
  if (config.enabled === false) continue;
  // existing lazy/eager logic
}
```

In `handleConfigChange`, compute key sets from upstream-only entries and refresh skills before completing reload:

```ts
const oldKeys = new Set(Object.entries(oldConfig).filter(([, value]) => isUpstreamConfig(value)).map(([key]) => key));
const newKeys = new Set(Object.entries(newConfig).filter(([, value]) => isUpstreamConfig(value)).map(([key]) => key));
```

Add before `this.searchEngine.warmup()` in the debounce:

```ts
this.skillService.refresh();
```

Add to `getSharedServices()`:

```ts
skillService: this.skillService,
```

- [ ] **Step 5: Register stdio skill tools**

Modify `src/tools/stdio-tool-registration.ts` imports:

```ts
import type { SkillGatewayService } from "../skills/SkillGatewayService.js";
```

Change signature:

```ts
export function createServer(
  toolService: GatewayToolService,
  statusHolder?: StatusHolder,
  skillService?: SkillGatewayService,
): McpServer {
```

Before status registration:

```ts
if (skillService) registerSkillTools(server, skillService);
```

Add helper:

```ts
function registerSkillTools(server: McpServer, skillService: SkillGatewayService): void {
  server.registerTool(
    "skills.search",
    {
      title: "Search Deferred Skills",
      description: "Search global deferred skills. Returns compact metadata only.",
      inputSchema: {
        query: z.string().optional().describe("Search query"),
        limit: z.number().optional().describe("Max results to return"),
      },
    },
    async ({ query, limit }) => runTool(() => skillService.search({ query, limit })),
  );

  server.registerTool(
    "skills.pull",
    {
      title: "Pull Deferred Skill",
      description: "Return one full SKILL.md plus metadata and resource map.",
      inputSchema: {
        id: z.string().describe("Skill ID from skills.search"),
      },
    },
    async ({ id }) => runTool(() => skillService.pull({ id })),
  );

  server.registerTool(
    "skills.read_resource",
    {
      title: "Read Skill Resource",
      description: "Read one support file from a deferred skill.",
      inputSchema: {
        id: z.string().describe("Skill ID from skills.search"),
        path: z.string().describe("Relative resource path"),
      },
    },
    async ({ id, path }) => runTool(() => skillService.readResource({ id, path })),
  );

  server.registerTool(
    "skills.status",
    {
      title: "Get Skill Gateway Status",
      description: "Report indexed skill roots, invalid skills, and migration status.",
      inputSchema: {},
    },
    async () => runTool(() => skillService.status()),
  );
}
```

- [ ] **Step 6: Register HTTP skill tools**

Modify `src/transports/http/request-router.ts` imports:

```ts
import type { SkillGatewayService } from "../../skills/SkillGatewayService.js";
import { SkillGatewayError } from "../../skills/SkillGatewayService.js";
import { SKILL_TOOL_SCHEMAS } from "../../tools/skill-tool-schemas.js";
```

Change constructor:

```ts
constructor(
  private readonly toolService: GatewayToolService,
  private readonly skillService?: SkillGatewayService,
) {}
```

In `handleToolsList`, concatenate schemas:

```ts
const tools = this.skillService ? [...GATEWAY_TOOL_SCHEMAS, ...SKILL_TOOL_SCHEMAS] : GATEWAY_TOOL_SCHEMAS;
return jsonRpcSuccess(id, {
  tools: tools.map((tool) => ({
    name: tool.name,
    title: tool.name.includes(".") ? tool.name.split(".")[1] : tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
});
```

Add cases in `handleToolsCall`:

```ts
case "skills.search":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.search({
    query: String(args.query || ""),
    limit: Number(args.limit) || 10,
  })));
case "skills.pull":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.pull({ id: String(args.id || "") })));
case "skills.read_resource":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.readResource({
    id: String(args.id || ""),
    path: String(args.path || ""),
  })));
case "skills.status":
  if (!this.skillService) return jsonRpcError(id, -32602, "Skill gateway is not available");
  return jsonRpcSuccess(id, toContent(this.skillService.status()));
```

In the catch block, handle `SkillGatewayError` like `GatewayToolError`:

```ts
if (error instanceof GatewayToolError || error instanceof SkillGatewayError) {
  return jsonRpcError(id, error.code, error.message);
}
```

Modify `src/transports/http/HttpMcpServer.ts` constructor:

```ts
import type { SkillGatewayService } from "../../skills/SkillGatewayService.js";
```

```ts
constructor(
  private readonly searchEngine: SearchEngine,
  private readonly connections: ConnectionManager,
  toolService: GatewayToolService,
  port?: number,
  skillService?: SkillGatewayService,
) {
  this.port = port || 8767;
  this.router = new HttpMcpRequestRouter(toolService, skillService);
}
```

Modify `src/index.ts` daemon construction:

```ts
const httpServer = new HttpMcpServer(
  services.searchEngine,
  services.connections,
  services.toolService,
  daemonPort,
  services.skillService,
);
```

- [ ] **Step 7: Run router tests, full tests, and build**

Run: `npm test -- tests/skill-tools-router.test.ts`

Expected: PASS.

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tools/skill-tool-schemas.ts src/tools/stdio-tool-registration.ts src/transports/http/request-router.ts src/transports/http/HttpMcpServer.ts src/gateway/MCPGateway.ts tests/skill-tools-router.test.ts
git commit -m "feat(skills): expose skill gateway tools"
```
