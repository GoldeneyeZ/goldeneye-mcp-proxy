# Lazy Skill Best Practices

Use this guide when writing skills that will be served through
`goldeneye-mcp-proxy` deferred skill tools. The goal is progressive disclosure:
agents should understand what the skill can do from metadata, load `SKILL.md`
only when relevant, then pull references, scripts, or assets only when needed.

## Target Structure

```text
skill-name/
├── SKILL.md
├── references/
│   ├── api.md
│   ├── workflow.md
│   └── examples.md
├── scripts/
│   └── validate-input.mjs
├── shared/
│   ├── conventions.md
│   └── config.json
└── assets/
    ├── template.json
    └── brand-logo.png
```

Keep `SKILL.md` small and navigational. Put detailed domain knowledge in
`references/`, reusable cross-step notes in `shared/`, deterministic helpers in
`scripts/`, and output files or templates in `assets/`.

## Write Searchable Metadata

The agent sees skill metadata before it sees the body. Make the frontmatter
description explicit about when the skill should be used.

```markdown
---
name: api-client-generator
description: Generate typed API clients from OpenAPI specs; use when creating,
  updating, validating, or packaging generated TypeScript clients.
---
```

Good descriptions include:

- Primary task verbs: generate, validate, migrate, deploy, analyze.
- Domain nouns users will say: OpenAPI, API client, TypeScript SDK.
- Trigger conditions: "use when..." or "for requests involving...".

Avoid vague descriptions like "Utilities for API work".

## Make `SKILL.md` a Router

`SKILL.md` should tell the agent what to do first and which extra files exist.
Every important reference or asset should be mentioned by relative path with a
short "when to use it" note.

```markdown
# API Client Generator

## Workflow

1. Inspect the user's target language and package manager.
2. Read [references/openapi-rules.md](references/openapi-rules.md) when changing
   generated type shapes or request serialization.
3. Use [assets/client-template/](assets/client-template/) when creating a new
   package layout.
4. Run `node scripts/validate-openapi.mjs <spec>` before finalizing generated
   clients.

## Resource Map

- `references/openapi-rules.md`: serialization, naming, and error-handling rules.
- `references/examples.md`: sample generated clients for common endpoints.
- `shared/conventions.md`: common naming and formatting conventions.
- `assets/client-template/`: package skeleton copied into new clients.
- `scripts/validate-openapi.mjs`: validation helper for input specs.
```

This matters because the lazy skill gateway lists common resource directories
(`references/`, `scripts/`, `assets/`, `shared/`), text files under
`references/`, `scripts/`, and `shared/`, plus markdown-linked files from
`SKILL.md`. If a support file is important, still link it directly from
`SKILL.md` and say when to use it.

## References

Use `references/` for text the agent may need to read into context:

- API docs, schemas, policies, domain rules, data dictionaries.
- Long examples that would make `SKILL.md` noisy.
- Framework-specific details, split by variant.

Best practices:

- Keep each reference focused on one decision area.
- Add a table of contents for files longer than about 100 lines.
- Prefer one-level links from `SKILL.md`; avoid chains where a reference points
  to another hidden reference.
- Tell the agent when to read the file, not just that the file exists.

Example:

```markdown
- Read [references/aws.md](references/aws.md) only for AWS deployments.
- Read [references/gcp.md](references/gcp.md) only for GCP deployments.
```

## Assets

Use `assets/` for files that should be used in output, copied, transformed, or
referenced by path. Assets usually should not be loaded into model context.

Good asset examples:

- Templates, starter projects, sample configs, slide decks.
- Images, icons, fonts, screenshots, fixtures.
- Boilerplate directories that the agent can copy into a project.

In `SKILL.md`, explain how to use the asset:

```markdown
- Use `assets/react-widget-template/` as the starting point for new widgets.
- Use `assets/company-logo.svg` when creating branded exports; do not recreate it.
- Use `assets/report-template.docx` as the base document for report generation.
```

Do not bury required assets in prose. Put them in a clear resource list.

## Shared Resources

Use `shared/` for text resources that support the skill but are not specific
enough to belong in one reference file:

- Common conventions used by multiple workflows.
- Shared prompts, checklists, schemas, or small config examples.
- Reusable notes that several reference files would otherwise duplicate.

Files in `shared/` are exposed in the lazy resource map when `skills.pull` loads
the parent skill. They are not indexed as standalone skills unless they contain
their own `SKILL.md`, which should be rare.

Example:

```markdown
- Read [shared/conventions.md](shared/conventions.md) before making style or
  naming decisions.
- Read [shared/error-codes.json](shared/error-codes.json) when mapping API
  errors.
```

## Scripts

Use `scripts/` when a repeated or fragile operation should be deterministic.

Good script examples:

- Validators, converters, migration helpers, generators.
- Small commands that avoid retyping complex logic.
- Checks that the agent should run before final output.

In `SKILL.md`, include command shape and when to run it:

```markdown
Run `node scripts/check-schema.mjs <schema.json>` after editing schema files.
If it fails, fix the schema before changing generated code.
```

## Lazy-Friendly Checklist

- `SKILL.md` has clear frontmatter `name` and `description`.
- `SKILL.md` is short enough to read quickly and contains only core workflow.
- Every important support file is linked from `SKILL.md` with a relative path.
- Each linked resource says when it should be read or used.
- Detailed docs live in `references/`, not duplicated in `SKILL.md`.
- Output templates and binary files live in `assets/`.
- Deterministic helpers live in `scripts/`.
- Shared reusable text resources live in `shared/`.
- Reference files are split by task, framework, provider, or domain.
- Asset instructions say whether to copy, modify, execute, or reference by path.
- No extra README, changelog, installation notes, or process history inside the
  skill folder unless the skill explicitly needs them.

## Anti-Patterns

- Hiding critical instructions only in an unlinked reference file.
- Listing `assets/` without explaining which asset to use for which task.
- Putting a full API manual in `SKILL.md`.
- Making one giant `references/all.md` that every task must read.
- Using absolute paths in skill instructions.
- Expecting the agent to read all resources after pulling a skill.
- Duplicating the same rules in `SKILL.md` and references.

## Minimal Template

```markdown
---
name: short-skill-name
description: Use when <task verbs> for <domain nouns>; includes <notable
  references/assets/scripts> for <specific outcomes>.
---

# Short Skill Name

## Workflow

1. Confirm the task matches this skill.
2. Follow the core steps here.
3. Pull extra resources only when the conditions below apply.

## Resources

- Read [references/main-rules.md](references/main-rules.md) when <condition>.
- Read [references/examples.md](references/examples.md) when examples are needed.
- Use `assets/template/` when creating <output>.
- Run `node scripts/validate.mjs <path>` before finalizing <artifact>.

## Constraints

- Keep task-specific constraints here.
- Put detailed background in references, not in this file.
```
