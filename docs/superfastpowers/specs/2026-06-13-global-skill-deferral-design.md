# Global Skill Deferral Design

## Context

goldeneye-mcp-proxy already reduces context load for MCP tools by exposing a small
gateway surface and lazy-loading upstream MCP servers only when a tool is invoked.
Skills create the same kind of context pressure: global Codex skills can be visible
at startup even when a session will not use most of them.

This design adds a separate skill gateway that makes global skills searchable and
pullable on demand. Project-local skills are intentionally out of scope because this
proxy is meant to be globally available.

## Goals

- Expose global skills through a dedicated MCP gateway surface.
- Avoid mixing skills into the existing MCP tool catalog and `gateway.search`.
- Prevent Codex from eagerly loading the same global skills by supporting an
  explicit migration from `~/.codex/skills` to a deferred directory.
- Return compact search results first, then full skill content only when requested.
- Let agents lazily read skill support files without recursively dumping assets,
  scripts, or reference docs into context.

## Non-Goals

- Do not scan project `.codex/skills` or `.opencode/skills` directories.
- Do not automatically rename user skill directories during normal startup.
- Do not execute skill scripts or install remote skills.
- Do not replace Codex's native skill format; `SKILL.md` remains the source format.

## Recommended Approach

Use a separate skill gateway with explicit migration support.

The default global source is `~/.codex/skills.deferred`. Users can add configured
sources for advanced layouts, but default scanning stays narrow and predictable.
The install or setup flow can offer an explicit migration command that renames
`~/.codex/skills` to `~/.codex/skills.deferred` and leaves a small marker directory
at `~/.codex/skills` so Codex no longer eagerly loads the migrated skills.

## Public MCP Tools

### `skills.search`

Search global deferred skills with BM25 scoring. Results are compact and never
include full skill bodies.

Returned fields:

- `id`
- `name`
- `description`
- `source`
- `path`
- `hash`
- `lastModified`
- `score`

### `skills.pull`

Return the full `SKILL.md` for one skill id, plus metadata and a bounded resource
map. The resource map lists nearby referenced files or directories but does not
include their contents.

Returned fields:

- `id`
- `name`
- `description`
- `source`
- `path`
- `hash`
- `lastModified`
- `content`
- `resources`

### `skills.read_resource`

Read one support file for a skill by skill id and relative path. This keeps
scripts, assets, and reference docs lazy.

Inputs:

- `id`
- `path`

### `skills.status`

Report skill gateway state:

- indexed roots
- skipped roots and reasons
- total skill count
- invalid skill count
- migration status for `~/.codex/skills` and `~/.codex/skills.deferred`

## Components

### `SkillConfig`

Resolves skill settings from defaults and optional config. Defaults include only
global deferred roots, starting with `~/.codex/skills.deferred`.

### `SkillRegistry`

Scans allowed global roots, finds `SKILL.md`, parses frontmatter, computes content
hashes, and produces stable skill records. Invalid skills are skipped with reasons
that appear in `skills.status`.

### `SkillSearchEngine`

Indexes skill metadata using the same MiniSearch style as tool search. Searchable
fields include name, description, source label, relative path, and optionally top
level headings from `SKILL.md`.

### `SkillGatewayService`

Implements `skills.search`, `skills.pull`, `skills.read_resource`, and
`skills.status`. It is separate from `GatewayToolService` to keep MCP tools and
skills independent.

### `SkillResourcePolicy`

Validates resource paths and file reads. It blocks path traversal, absolute paths,
symlink escapes, oversized files, and binary or unsupported file types.

### `SkillMigrationService`

Provides explicit migration and rollback support for global Codex skills.
Migration is CLI-triggered, never part of normal gateway startup.

## Data Flow

1. Gateway startup loads the existing MCP config and initializes normal tool
   services.
2. The skill registry scans global deferred roots only.
3. Each valid skill becomes a compact index record with id, frontmatter metadata,
   source, path, hash, and modified time.
4. `skills.search` queries the skill index and returns compact results.
5. `skills.pull` reads the selected `SKILL.md` and returns it with metadata and a
   bounded resource map.
6. `skills.read_resource` reads one validated support file on demand.
7. Config reload refreshes the skill registry and index without touching upstream
   MCP connections.

## Skill Identity

Skill ids must be stable across process restarts and resilient to duplicate names.
Use a normalized id derived from source label and path, for example:

```text
codex-deferred::caveman/caveman-review
```

If a source label or path changes, the id changes. Duplicate skill `name` values
are allowed because consumers use ids returned by `skills.search`.

## Resource Map

`skills.pull` should expose a small resource map so the agent can decide what to
read next. The map can include direct child folders such as `scripts/`, `assets/`,
and `references/`, plus markdown files explicitly referenced by relative links in
`SKILL.md`.

Limits:

- cap number of resource entries
- include size and type metadata
- omit file contents
- mark skipped resources with reasons when useful

## Migration CLI

Add explicit commands:

```bash
goldeneye-mcp-proxy --defer-codex-skills --dry-run
goldeneye-mcp-proxy --defer-codex-skills
goldeneye-mcp-proxy --restore-codex-skills --dry-run
goldeneye-mcp-proxy --restore-codex-skills
```

Migration behavior:

1. Verify `~/.codex/skills` exists.
2. Verify `~/.codex/skills.deferred` does not already contain conflicting data.
3. Rename `~/.codex/skills` to `~/.codex/skills.deferred`.
4. Create `~/.codex/skills/README.md` explaining that global skills are deferred
   through goldeneye-mcp-proxy.
5. Report exactly what changed.

Rollback behavior:

1. Verify `~/.codex/skills` is still only the marker directory.
2. Verify `~/.codex/skills.deferred` exists.
3. Remove the marker directory.
4. Rename `~/.codex/skills.deferred` back to `~/.codex/skills`.

## Error Handling

- Missing or unreadable roots are non-fatal and appear in `skills.status`.
- Invalid frontmatter causes the individual skill to be skipped, not the gateway.
- Duplicate names are allowed because ids include source and path.
- Stale ids after reload return a clear not-found error.
- Resource reads reject absolute paths, `..`, symlinks escaping the skill root,
  oversized files, and unsupported file types.
- Migration commands fail before mutation when preconditions are not met.

## Testing

- Unit tests for frontmatter parsing, id generation, duplicate names, and search.
- Resource policy tests for traversal, symlink escape, size limits, binary files,
  and valid relative docs or scripts.
- Service tests for `skills.search`, `skills.pull`, `skills.read_resource`, and
  `skills.status`.
- CLI migration tests using temporary home directories.
- Integration test that starts the MCP server and verifies `skills.*` tools are
  listed separately from existing `gateway.*` tools.

## Rollout

1. Implement the skill registry, search engine, service, and resource policy.
2. Register the new `skills.*` MCP tools in stdio and HTTP paths.
3. Add status output and tests.
4. Add explicit migration and rollback CLI commands.
5. Update docs and setup prompts to recommend deferring global Codex skills.

## Implementation Defaults

- Use a reserved top-level config key named `_skills` for skill gateway settings.
  This avoids colliding with ordinary upstream MCP server keys.
- Model custom sources as `_skills.sources`, where each source has `label`, `path`,
  and optional `enabled`.
- Use a default resource read limit of 128 KiB per file.
- Cap resource map entries at 50 per skill.
- Index skill name, description, source label, relative path, and Markdown H1/H2
  headings from `SKILL.md` in the first release. Do not index full skill bodies.
