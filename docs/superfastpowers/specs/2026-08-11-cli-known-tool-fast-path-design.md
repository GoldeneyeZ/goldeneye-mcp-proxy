# Direct-MCP Known-Tool Fast Path

## Goal

Let agents use Goldeneye MCP gateway tools directly, avoiding redundant discovery and response tokens without any command-line workflow.

## Behavior

Use `gateway.invoke` or `gateway.invoke_async` immediately when either condition holds:

- the agent knows the exact tool ID and current argument schema; or
- the same tool was invoked successfully during the current session.

If the ID is unknown, run `gateway.search`. If the schema is unknown, uncertain, or rejected, run `gateway.describe`. Never rediscover a known current tool.

Poll async jobs through `gateway.invoke_status`. Retrieve only needed portions of top-level `_ref` results through `gateway.get_result`.

## Scope

Keep the skill at `skills/using-goldeneye-mcp/`. Update agent metadata and package tests. Validate frontmatter, package inclusion, exact fast-path behavior, all six gateway MCP tools, and absence of command-line guidance.
