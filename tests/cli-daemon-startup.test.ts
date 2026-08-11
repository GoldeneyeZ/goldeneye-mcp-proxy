import test from "node:test";
import assert from "node:assert/strict";
import { deriveHealthUrl, ensureDaemon } from "../src/cli/daemon-startup.js";

test("derives the health endpoint from the configured MCP URL", () => {
  assert.equal(
    deriveHealthUrl("http://127.0.0.1:8767/mcp?session=old#fragment"),
    "http://127.0.0.1:8767/health",
  );
  assert.equal(
    deriveHealthUrl("https://gateway.example.test/api/mcp"),
    "https://gateway.example.test/api/health",
  );
});

test("short-circuits startup when health is already available", async () => {
  const calls: string[] = [];
  const result = await ensureDaemon("http://127.0.0.1:8767/mcp", {
    health: async (url) => { calls.push(`health:${url}`); return true; },
    startSystemd: async () => { calls.push("systemd"); return true; },
    startDetached: () => { calls.push("detached"); },
    sleep: async () => { calls.push("sleep"); },
    now: () => 0,
  });

  assert.equal(result, true);
  assert.deepEqual(calls, ["health:http://127.0.0.1:8767/health"]);
});

test("tries systemd before detached fallback and stops when healthy", async () => {
  const calls: string[] = [];
  const result = await ensureDaemon("http://127.0.0.1:8767/mcp", {
    health: async () => calls.filter(value => value === "sleep").length > 0,
    startSystemd: async () => { calls.push("systemd"); return true; },
    startDetached: () => { calls.push("detached"); },
    sleep: async () => { calls.push("sleep"); },
    now: (() => { let value = 0; return () => value += 100; })(),
  }, 5000);

  assert.equal(result, true);
  assert.deepEqual(calls, ["systemd", "sleep"]);
});

test("uses exactly one detached fallback and returns false at the deadline", async () => {
  const calls: string[] = [];
  const result = await ensureDaemon("http://127.0.0.1:8767/mcp", {
    health: async () => false,
    startSystemd: async () => { calls.push("systemd"); return false; },
    startDetached: () => { calls.push("detached"); },
    sleep: async () => { calls.push("sleep"); },
    now: (() => { let value = 0; return () => value += 3000; })(),
  }, 5000);

  assert.equal(result, false);
  assert.equal(calls.filter(value => value === "detached").length, 1);
  assert.deepEqual(calls.slice(0, 2), ["systemd", "detached"]);
});

test("bounds polling sleeps to the remaining five-second window", async () => {
  let currentTime = 0;
  const sleeps: number[] = [];
  const result = await ensureDaemon("http://127.0.0.1:8767/mcp", {
    health: async () => false,
    startSystemd: async () => false,
    startDetached: () => {},
    sleep: async (milliseconds) => { sleeps.push(milliseconds); currentTime += milliseconds; },
    now: () => currentTime,
  }, 5000);

  assert.equal(result, false);
  assert.equal(sleeps.reduce((total, value) => total + value, 0), 5000);
  assert.ok(sleeps.every(value => value > 0 && value <= 100));
});
