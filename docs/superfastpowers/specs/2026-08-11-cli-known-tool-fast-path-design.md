# Direct-MCP Known-Tool Fast Path

## Goal

Let agents use direct MCP for known tools, avoiding CLI and discovery overhead without weakening schema safety.

## Behavior

Add an explicit fast-path rule before the skill's CLI workflow. Bypass the CLI and use the direct MCP tool when either condition holds:

- the agent knows the exact tool ID and current argument schema; or
- the same tool was invoked successfully during the current session.

Invoke through MCP using the known arguments. If the ID, schema, or freshness is uncertain—or invocation reports a schema/input mismatch—return to CLI `describe` before retrying. Run CLI `search` only when the exact tool ID is unknown. Use the normal CLI workflow when direct MCP access is unavailable.

Async polling, `_ref` slicing, endpoint selection, compact JSON parsing, exit-code handling, and secret-safe stdin guidance remain unchanged.

## Scope

Edit only `skills/using-goldeneye-cli/SKILL.md`. Keep the existing symlink valid automatically because it targets this directory. Validate frontmatter/structure, word count, exact fast-path wording, and existing workflow guidance.
