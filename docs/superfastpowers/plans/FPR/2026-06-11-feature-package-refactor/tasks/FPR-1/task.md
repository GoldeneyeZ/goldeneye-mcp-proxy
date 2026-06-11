## Task 1: Add Verification Harness And JSON-RPC Helper

<TASK-ID>FPR-1</TASK-ID>

**Files:**
- Modify: `package.json`
- Create: `src/transports/http/json-rpc.ts`
- Create: `tests/json-rpc.test.ts`

- [ ] **Step 1: Write the failing test and test script**

Modify `package.json` scripts to include a Node test runner command:

```json
"scripts": {
  "build": "tsc",
  "test": "node --loader ts-node/esm --test tests/**/*.test.ts",
  "prepublishOnly": "npm run build",
  "dev": "node --loader ts-node/esm src/index.ts",
  "start": "node dist/index.js"
}
```

Create `tests/json-rpc.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { jsonRpcError, jsonRpcSuccess } from "../src/transports/http/json-rpc.js";

test("jsonRpcSuccess returns a JSON-RPC success envelope", () => {
  assert.deepEqual(jsonRpcSuccess("abc", { ok: true }), {
    jsonrpc: "2.0",
    id: "abc",
    result: { ok: true },
  });
});

test("jsonRpcError returns a JSON-RPC error envelope with data", () => {
  assert.deepEqual(jsonRpcError(null, -32602, "Invalid params", { field: "name" }), {
    jsonrpc: "2.0",
    id: null,
    error: {
      code: -32602,
      message: "Invalid params",
      data: { field: "name" },
    },
  });
});

test("jsonRpcError omits data when not provided", () => {
  assert.deepEqual(jsonRpcError(7, -32700, "Parse error"), {
    jsonrpc: "2.0",
    id: 7,
    error: {
      code: -32700,
      message: "Parse error",
    },
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --test-name-pattern=jsonRpc`

Expected: FAIL because `../src/transports/http/json-rpc.js` does not exist.

- [ ] **Step 3: Add the JSON-RPC helper**

Create `src/transports/http/json-rpc.ts`:

```ts
export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export function jsonRpcSuccess(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  const error: JsonRpcResponse["error"] = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}
```

- [ ] **Step 4: Run verification**

Run: `npm test -- --test-name-pattern=jsonRpc`

Expected: PASS, 3 tests pass.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

- [ ] **Step 5: Commit**

```bash
git add package.json src/transports/http/json-rpc.ts tests/json-rpc.test.ts
git commit -m "test: add json rpc helper coverage"
```
