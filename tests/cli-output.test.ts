import test from "node:test";
import assert from "node:assert/strict";
import { writeFailure, writeSuccess, toCliError } from "../src/cli/output.js";
import { CliError } from "../src/cli/types.js";

test("writes one compact JSON line to stdout", () => {
  const writes: string[] = [];
  writeSuccess({ found: 1 }, value => writes.push(value));
  assert.deepEqual(writes, ['{"found":1}\n']);
});

test("writes stable error envelope without supplied args", () => {
  const writes: string[] = [];
  writeFailure(new CliError("INVALID_ARGS", "bad input", 2), value => writes.push(value));
  assert.deepEqual(writes, ['{"error":{"code":"INVALID_ARGS","message":"bad input"}}\n']);
});

test("preserves typed CLI failures", () => {
  const expected = new CliError("GATEWAY_ERROR", "gateway rejected request", 4);
  assert.equal(toCliError(expected), expected);
});

test("classifies unexpected values without exposing details", () => {
  const error = toCliError(new Error('secret {"token":"value"}'));
  assert.deepEqual(
    { name: error.name, code: error.code, message: error.message, exitCode: error.exitCode },
    { name: "CliError", code: "INTERNAL_ERROR", message: "Unexpected CLI error", exitCode: 5 },
  );
});
