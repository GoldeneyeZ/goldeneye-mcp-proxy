# CLI Known-Tool Fast Path

## Goal

Let agents invoke a known gateway tool directly, avoiding redundant discovery tokens without weakening schema safety.

## Behavior

Add an explicit fast-path rule before the skill's required workflow. Skip both `search` and `describe` when either condition holds:

- the agent knows the exact tool ID and current argument schema; or
- the same tool was invoked successfully during the current session.

Invoke directly using the known arguments. If the ID, schema, or freshness is uncertain—or invocation reports a schema/input mismatch—run `describe` before retrying. Run `search` only when the exact tool ID is unknown.

Async polling, `_ref` slicing, endpoint selection, compact JSON parsing, exit-code handling, and secret-safe stdin guidance remain unchanged.

## Scope

Edit only `skills/using-goldeneye-cli/SKILL.md`. Keep the existing symlink valid automatically because it targets this directory. Validate frontmatter/structure, word count, exact fast-path wording, and existing workflow guidance.
