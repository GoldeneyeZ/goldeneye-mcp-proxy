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
