# goldeneye-mcp-proxy - Agent Context for Deferred Skills

Use this MCP when an agent needs skill instructions without loading every global
skill into the model context at startup. The proxy exposes deferred skills as
searchable metadata first, then loads full `SKILL.md` files and support resources
only when a task actually needs them.

## Core Rule

Do not assume a skill is already in context. Discover it through the `skills.*`
tools, pull only the relevant skill, then read only the referenced support files
needed for the current task.

## Skill Workflow

1. Check availability when needed:
   `skills.status({})`

   Use this to see indexed roots, skill counts, invalid skills, and migration
   state for `~/.codex/skills.deferred` and `~/.agents/skills.deferred`.

2. Search by intent:
   `skills.search({ "query": "create a new skill", "limit": 5 })`

   Search matches skill name, description, source, path, and headings. Results
   are compact metadata only: `id`, `name`, `description`, `source`, `path`,
   `hash`, `lastModified`, and `score`.

3. Pull the selected skill:
   `skills.pull({ "id": "<skill-id>" })`

   This returns the full `SKILL.md` content plus metadata and a bounded
   `resources` list. Follow the pulled skill's instructions for the current
   turn.

4. Read support files selectively:
   `skills.read_resource({ "id": "<skill-id>", "path": "references/foo.md" })`

   Only read resources that the pulled skill explicitly references or that are
   directly needed. Resource paths are relative to the skill directory.

## Available Tools

| Tool | Use |
|------|-----|
| `skills.list` | Browse compact skill metadata with optional `source`, `limit`, and `offset`. |
| `skills.search` | Find skills by task intent. Prefer this over listing everything. |
| `skills.pull` | Load one full `SKILL.md` by `id`. |
| `skills.read_resource` | Load one allowed support file for a pulled skill. |
| `skills.status` | Inspect indexed roots, invalid skills, counts, and migration state. |

## Agent Behavior

- Use `skills.search` before doing specialized work unless the user already named
  an available skill.
- Pull the smallest set of skills that covers the request.
- After pulling a skill, obey its trigger rules and workflow for the current turn.
- Treat `resources` from `skills.pull` as a map of possible follow-up context, not
  as a command to read everything.
- Prefer files under common skill resource directories such as `references/`,
  `scripts/`, `assets/`, and `shared/` only when the pulled `SKILL.md` points
  there or the resource name directly matches the current task.
- If `skills.search` returns no useful result, continue with normal reasoning and
  tell the user only when the missing skill affects the outcome.
- If `skills.read_resource` rejects a path, do not retry with absolute paths or
  parent-directory traversal. Ask for another source or proceed without it.

## Defaults

The proxy indexes deferred skill roots by default:

- `~/.codex/skills.deferred`
- `~/.agents/skills.deferred`

The normal skill migration commands move eager skill directories into these
deferred roots so agents can search and pull skills on demand instead of loading
all skill bodies into every session.
