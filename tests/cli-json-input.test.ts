import test from "node:test";
import assert from "node:assert/strict";
import { readArgs } from "../src/cli/json-input.js";
import { CliError } from "../src/cli/types.js";

test("parses an inline JSON object", async () => {
  assert.deepEqual(await readArgs('{"x":1}', async () => ""), { x: 1 });
});

test("reads a JSON object from stdin", async () => {
  assert.deepEqual(await readArgs("-", async () => '{"secret":"value"}'), { secret: "value" });
});

for (const [name, source] of [
  ["arrays", '["secret-array-value"]'],
  ["scalars", '"secret-scalar-value"'],
  ["null", "null"],
  ["malformed JSON", '{"secret-malformed-value"'],
] as const) {
  test(`rejects ${name} without echoing supplied JSON`, async () => {
    await assert.rejects(readArgs(source, async () => ""), (error: unknown) => {
      assert.ok(error instanceof CliError);
      assert.equal(error.code, "INVALID_ARGS");
      assert.equal(error.exitCode, 2);
      assert.doesNotMatch(error.message, /secret-(?:array|scalar|malformed)-value/);
      return true;
    });
  });
}

test("does not invoke stdin reader for inline JSON", async () => {
  let reads = 0;
  await readArgs("{}", async () => { reads += 1; return "{}"; });
  assert.equal(reads, 0);
});
