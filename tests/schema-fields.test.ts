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
