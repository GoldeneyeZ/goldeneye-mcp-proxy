import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { resolveSkillConfig } from "../src/config/skill-config.js";

test("resolveSkillConfig defaults to the global deferred Codex source", () => {
  const config = resolveSkillConfig({}, "/tmp/home");

  assert.deepEqual(config.sources, [{
    label: "codex-deferred",
    path: join("/tmp/home", ".codex", "skills.deferred"),
    enabled: true,
  }]);
  assert.equal(config.maxResourceBytes, 128 * 1024);
  assert.equal(config.maxResourceEntries, 50);
});

test("resolveSkillConfig appends enabled custom sources", () => {
  const config = resolveSkillConfig({
    _skills: {
      sources: [
        { label: "team", path: "/opt/team-skills" },
        { label: "off", path: "/opt/off", enabled: false },
      ],
      maxResourceBytes: 4096,
      maxResourceEntries: 12,
    },
  }, "/tmp/home");

  assert.equal(config.sources.length, 2);
  assert.equal(config.sources[1].label, "team");
  assert.equal(config.maxResourceBytes, 4096);
  assert.equal(config.maxResourceEntries, 12);
});
