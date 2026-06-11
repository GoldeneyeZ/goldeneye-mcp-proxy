## Task 3: Extract Search Schema Field Helpers

<TASK-ID>FPR-3</TASK-ID>

**Files:**
- Create: `src/search/schema-fields.ts`
- Create: `tests/schema-fields.test.ts`
- Modify: `src/search/SearchEngine.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/schema-fields.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { extractFieldNames, toCamelCase } from "../src/search/schema-fields.js";

test("toCamelCase normalizes common tool names", () => {
  assert.equal(toCamelCase("Run Cypher Query"), "runCypherQuery");
  assert.equal(toCamelCase("browser_navigate"), "browserNavigate");
  assert.equal(toCamelCase("github.create-issue"), "githubCreateIssue");
});

test("extractFieldNames reads object schema properties", () => {
  const schema = {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
  };

  assert.deepEqual(extractFieldNames(schema), ["query", "limit"]);
});

test("extractFieldNames returns an empty array for non-object schemas", () => {
  assert.deepEqual(extractFieldNames(undefined), []);
  assert.deepEqual(extractFieldNames({ type: "string" }), []);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="schema|camel"`

Expected: FAIL because `src/search/schema-fields.ts` does not exist.

- [ ] **Step 3: Create helper module**

Move the current helper logic from `src/search/SearchEngine.ts` into `src/search/schema-fields.ts`:

```ts
export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

export function extractFieldNames(schema: unknown): string[] {
  if (!schema || typeof schema !== "object") return [];
  const obj = schema as { properties?: Record<string, unknown> };
  if (!obj.properties || typeof obj.properties !== "object") return [];
  return Object.keys(obj.properties);
}
```

- [ ] **Step 4: Update `SearchEngine` imports**

In `src/search/SearchEngine.ts`, remove local `toCamelCase` and `extractFieldNames` declarations and add:

```ts
import { extractFieldNames, toCamelCase } from "./schema-fields.js";
```

- [ ] **Step 5: Run verification**

Run: `npm test -- --test-name-pattern="schema|camel"`

Expected: PASS, 3 schema helper tests pass.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

- [ ] **Step 6: Commit**

```bash
git add src/search/SearchEngine.ts src/search/schema-fields.ts tests/schema-fields.test.ts
git commit -m "refactor: extract search schema helpers"
```
