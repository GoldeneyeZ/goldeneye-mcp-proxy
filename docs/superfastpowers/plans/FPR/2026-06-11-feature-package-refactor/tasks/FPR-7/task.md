## Task 7: Split Response Store And Shielding Helpers

<TASK-ID>FPR-7</TASK-ID>

**Files:**
- Move/Modify: `src/response-store.ts` -> `src/responses/ResponseStore.ts`
- Create: `src/responses/ResponseShield.ts`
- Create: `src/responses/response-slicing.ts`
- Create: `src/responses/response-truncation.ts`
- Create: `tests/response-truncation.test.ts`
- Modify: imports in gateway/tool service files

- [ ] **Step 1: Write failing truncation tests**

Create `tests/response-truncation.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { stripHeavyFields, truncateArrays, truncateStrings } from "../src/responses/response-truncation.js";

test("truncateArrays caps long arrays and appends metadata", () => {
  let truncated = false;
  const input = Array.from({ length: 55 }, (_, index) => ({ index }));
  const output = truncateArrays(input, () => { truncated = true; }) as unknown[];

  assert.equal(truncated, true);
  assert.equal(output.length, 51);
  assert.deepEqual(output[50], {
    _truncated: true,
    _total: 55,
    _showing: 50,
    _message: "[TRUNCATED: 5 more items. Use gateway.get_result to paginate]",
  });
});

test("stripHeavyFields removes large non-signal fields", () => {
  let stripped = false;
  const input = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    payload: "x".repeat(300),
  }));
  const output = stripHeavyFields(input, () => { stripped = true; }) as Array<Record<string, unknown>>;

  assert.equal(stripped, true);
  assert.equal(output[0].id, "0");
  assert.equal("payload" in output[0], false);
  assert.deepEqual(output[0]._omitted, ["payload"]);
});

test("truncateStrings caps long strings", () => {
  let truncated = false;
  const output = truncateStrings("x".repeat(8200), () => { truncated = true; }) as string;

  assert.equal(truncated, true);
  assert.equal(output.startsWith("x".repeat(8192)), true);
  assert.match(output, /\[\.\.\.TRUNCATED: 8 more chars\]/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --test-name-pattern="truncate|stripHeavyFields"`

Expected: FAIL because `src/responses/response-truncation.ts` does not exist.

- [ ] **Step 3: Move response files**

Run:

```bash
mkdir -p src/responses
git mv src/response-store.ts src/responses/ResponseStore.ts
```

Split the moved file:

- Keep `ResponseStore` in `src/responses/ResponseStore.ts`.
- Move `ResponseShield` to `src/responses/ResponseShield.ts`.
- Move `extractArray` and string slicing support to `src/responses/response-slicing.ts`.
- Move `deepClone`, `truncateArrays`, `stripHeavyFields`, `truncateStrings`, and `enforceMaxSize` to `src/responses/response-truncation.ts`.

- [ ] **Step 4: Implement truncation helper exports**

`src/responses/response-truncation.ts` should export constants and pure functions:

```ts
export const MAX_ARRAY_LENGTH = 50;
export const MAX_STRING_LENGTH = 8192;
export const MAX_RESPONSE_BYTES = 65536;
export const HEAVY_FIELD_THRESHOLD = 256;

const SIGNAL_FIELDS = new Set([
  "id", "name", "title", "type", "status", "state", "label",
  "sha", "ref", "path", "url", "html_url",
  "created_at", "updated_at", "number", "key",
  "message", "description", "summary", "error",
]);

export function deepClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export function truncateArrays(data: unknown, onTruncate: (v: boolean) => void): unknown {
  if (Array.isArray(data)) {
    if (data.length > MAX_ARRAY_LENGTH) {
      onTruncate(true);
      const kept = data.slice(0, MAX_ARRAY_LENGTH);
      return [
        ...kept,
        {
          _truncated: true,
          _total: data.length,
          _showing: MAX_ARRAY_LENGTH,
          _message: `[TRUNCATED: ${data.length - MAX_ARRAY_LENGTH} more items. Use gateway.get_result to paginate]`,
        },
      ];
    }
    return data.map((item) => truncateArrays(item, onTruncate));
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateArrays(value, onTruncate);
    }
    return result;
  }

  if (typeof data === "string" && data.length > 1000) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > MAX_ARRAY_LENGTH) {
        onTruncate(true);
        const kept = parsed.slice(0, MAX_ARRAY_LENGTH);
        kept.push({
          _truncated: true,
          _total: parsed.length,
          _showing: MAX_ARRAY_LENGTH,
          _message: `[TRUNCATED: ${parsed.length - MAX_ARRAY_LENGTH} more items. Use gateway.get_result to paginate]`,
        });
        return JSON.stringify(kept);
      }
    } catch {
      return data;
    }
  }

  return data;
}

export function stripHeavyFields(data: unknown, onStrip: (v: boolean) => void): unknown {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data) && data.length > 5) {
    const sampleSize = Math.min(data.length, 10);
    const sample = data.slice(0, sampleSize);

    if (sample.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      const fieldSizes = new Map<string, number>();
      const fieldCounts = new Map<string, number>();

      for (const item of sample) {
        const obj = item as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
          const size = JSON.stringify(value).length;
          fieldSizes.set(key, (fieldSizes.get(key) || 0) + size);
          fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
        }
      }

      const heavyFields: string[] = [];
      for (const [field, totalSize] of fieldSizes) {
        const count = fieldCounts.get(field) || 1;
        const avg = totalSize / count;
        if (avg > HEAVY_FIELD_THRESHOLD && !SIGNAL_FIELDS.has(field)) {
          heavyFields.push(field);
        }
      }

      if (heavyFields.length > 0) {
        onStrip(true);
        return data.map((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            const obj = item as Record<string, unknown>;
            const stripped: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
              if (!heavyFields.includes(key)) {
                stripped[key] = value;
              }
            }
            stripped._omitted = heavyFields;
            return stripped;
          }
          return item;
        });
      }
    }
  }

  if (!Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = stripHeavyFields(value, onStrip);
    }
    return result;
  }

  return data;
}

export function truncateStrings(data: unknown, onTruncate: (v: boolean) => void): unknown {
  if (typeof data === "string") {
    if (data.length > MAX_STRING_LENGTH) {
      onTruncate(true);
      return data.slice(0, MAX_STRING_LENGTH) + `\n[...TRUNCATED: ${data.length - MAX_STRING_LENGTH} more chars]`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => truncateStrings(item, onTruncate));
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateStrings(value, onTruncate);
    }
    return result;
  }

  return data;
}

export function enforceMaxSize(data: unknown): unknown {
  let current = deepClone(data);
  let iterations = 0;
  const maxIterations = 20;

  while (JSON.stringify(current).length > MAX_RESPONSE_BYTES && iterations < maxIterations) {
    iterations++;

    if (typeof current === "object" && current !== null) {
      const obj = current as Record<string, unknown>;

      if (Array.isArray(obj.content)) {
        for (let i = 0; i < obj.content.length; i++) {
          const item = obj.content[i] as Record<string, unknown>;
          if (item && typeof item.text === "string" && item.text.length > 2000) {
            const text = item.text;
            item.text = text.slice(0, Math.floor(text.length / 2)) +
              `\n[...TRUNCATED to fit 64KB limit]`;
          }
        }
      }

      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value) && value.length > 10) {
          const halfLen = Math.floor(value.length * 0.75);
          obj[key] = [
            ...value.slice(0, halfLen),
            {
              _truncated: true,
              _dropped: value.length - halfLen,
              _message: "[Dropped items to fit 64KB response limit. Use gateway.get_result to paginate]",
            },
          ];
        }
      }
    }

    if (typeof current === "string" && current.length > MAX_RESPONSE_BYTES) {
      current = current.slice(0, MAX_RESPONSE_BYTES - 100) +
        `\n[...TRUNCATED to fit 64KB limit]`;
    }
  }

  return current;
}
```

- [ ] **Step 5: Update `ResponseShield` coordinator**

`src/responses/ResponseShield.ts` should import helpers and keep only orchestration:

```ts
import type { ShieldResult } from "../shared/types.js";
import { ResponseStore } from "./ResponseStore.js";
import { deepClone, enforceMaxSize, MAX_RESPONSE_BYTES, stripHeavyFields, truncateArrays, truncateStrings } from "./response-truncation.js";

export class ResponseShield {
  constructor(private readonly responseStore: ResponseStore) {}

  shield(toolId: string, raw: unknown): ShieldResult {
    let shielded = deepClone(raw);
    let wasTruncated = false;

    shielded = truncateArrays(shielded, (didTruncate) => {
      if (didTruncate) wasTruncated = true;
    });

    shielded = stripHeavyFields(shielded, (didStrip) => {
      if (didStrip) wasTruncated = true;
    });

    shielded = truncateStrings(shielded, (didTruncate) => {
      if (didTruncate) wasTruncated = true;
    });

    if (JSON.stringify(shielded).length > MAX_RESPONSE_BYTES) {
      shielded = enforceMaxSize(shielded);
      wasTruncated = true;
    }

    const ref = wasTruncated ? this.responseStore.store(toolId, raw) : null;
    return { shielded, ref, wasTruncated };
  }
}
```

- [ ] **Step 6: Run verification**

Run: `npm test -- --test-name-pattern="truncate|stripHeavyFields"`

Expected: PASS with truncation helper tests.

Run: `./node_modules/.bin/tsc --noEmit`

Expected: PASS with no diagnostics.

Run: `npm test`

Expected: PASS with all tests.

- [ ] **Step 7: Commit**

```bash
git add src/responses src tests
git commit -m "refactor: split response shielding helpers"
```
