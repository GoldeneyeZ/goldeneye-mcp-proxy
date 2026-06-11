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
