# 06 - Find rule

Enumerate installed rules across every AI tool surface, recommend the best match for the user's stated intent.

## Inputs

- Free-form user intent.
- Installed AI tool surfaces (one or more of: Claude, Cursor, Copilot, OpenCode).

## Outputs

A markdown table of installed rules + a recommendation block.

```text
| Tool     | Path                                         | Rule              | Purpose                          | Scope (paths)            |
| -------- | -------------------------------------------- | ----------------- | -------------------------------- | ------------------------ |
| claude   | .claude/rules/01-standards/1-mermaid.md      | mermaid           | Mermaid generation rules         | -                        |
| cursor   | .cursor/rules/01-standards/1-mermaid.mdc     | mermaid           | Mermaid generation rules         | -                        |
| copilot  | .github/instructions/api-typescript.instr... | api-typescript    | API conventions for TS endpoints | src/api/**/*.ts          |
| ...      | ...                                          | ...               | ...                              | ...                      |

Recommendation: <best-match rule name + tool>
Why: <one sentence>
Source: <relative path>
```

## Process

1. **Enumerate rules.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/list-rules.mjs` from the user's project root; accept a silent empty array when no surface contains rules.
2. **Extract metadata.** For each entry, read `tool`, `path`, `name`, `description`, `paths` from the JSON output.
3. **Render the table.** Columns: `Tool | Path | Rule | Purpose | Scope (paths)`. Sort by tool then rule name.
4. **Ask the user for intent.** `Which behavior or scope are you looking for?` Wait for an explicit reply.
5. **Match.** Score each rule against the stated intent (name + description + `paths` scope). Pick the single best match. If tied, list both.
6. **Print the recommendation block.** Rule name, owning tool, one-sentence rationale, source path.
7. **Stop.** Do not edit or invoke the rule.

## Test

The output contains a non-empty rules table whose rows match the JSON inventory produced by `list-rules.mjs`, followed by a recommendation block that names one rule present in the table, its owning tool, a one-line rationale, and the rule's source path.
