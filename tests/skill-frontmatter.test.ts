import test from "node:test";
import assert from "node:assert/strict";
import { extractMarkdownHeadings, parseSkillMarkdown } from "../src/skills/skill-frontmatter.js";

test("parseSkillMarkdown reads required yaml frontmatter fields", () => {
  const parsed = parseSkillMarkdown(`---
name: code-review
description: Review pull requests and diffs.
---

# Code Review

Body text.
`);

  assert.deepEqual(parsed.frontmatter, {
    name: "code-review",
    description: "Review pull requests and diffs.",
  });
  assert.equal(parsed.body.trim(), "# Code Review\n\nBody text.");
});

test("parseSkillMarkdown supports folded multiline descriptions", () => {
  const parsed = parseSkillMarkdown(`---
name: caveman-review
description: >
  Ultra-compressed review comments.
  Preserve actionable signal.
---
# Review
`);

  assert.equal(parsed.frontmatter.name, "caveman-review");
  assert.equal(parsed.frontmatter.description, "Ultra-compressed review comments. Preserve actionable signal.");
});

test("parseSkillMarkdown rejects missing frontmatter", () => {
  assert.throws(() => parseSkillMarkdown("# No metadata"), /Missing SKILL.md frontmatter/);
});

test("parseSkillMarkdown rejects missing required fields", () => {
  assert.throws(() => parseSkillMarkdown(`---
name: incomplete
---
Body`), /Missing required skill frontmatter field: description/);
});

test("extractMarkdownHeadings returns h1 and h2 text only", () => {
  assert.deepEqual(extractMarkdownHeadings("# Main\n\n## Setup\n\n### Detail\n\n## Usage"), ["Main", "Setup", "Usage"]);
});
