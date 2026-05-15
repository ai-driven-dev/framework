# 03 - Find command

Enumerate installed slash commands across all plugins, capture the user's intent, recommend the best match with its invocation path.

## Inputs

- Free-form user intent.
- Installed plugins available to the current AI tool.

## Outputs

A markdown table of installed commands + a recommendation block.

```text
| Plugin       | Command          | Purpose                       |
| ------------ | ---------------- | ----------------------------- |
| aidd-vcs     | /commit          | Stage + commit with conv-cc   |
| aidd-vcs     | /pull-request    | Open PR with summary          |
| ...          | ...              | ...                           |

Recommendation: <best-match command>
Why: <one sentence>
Invoke with: <exact /command string>
```

## Process

1. **Enumerate installed commands.** Use the AI tool's native command discovery to list every installed slash command.
2. **Extract metadata.** Read `name`, `description`, and `argument-hint` (if present) from each command's frontmatter. Skip malformed entries and log them.
3. **Render the table.** Columns: `Plugin | Command | Purpose`. Sort by plugin then command name. One row per command.
4. **Ask the user for intent.** `What do you want to run?` Wait for an explicit reply.
5. **Match.** Pick the single best command. If two are tied, list both.
6. **Print the recommendation block.** Command, one-sentence rationale, exact invocation string with placeholders for any required arguments.
7. **Stop.** Do not run the command.

## Test

The output contains a non-empty commands table matching what the AI tool actually has installed, followed by a recommendation block that names one command present in the table, a one-line rationale, and an exact invocation string.
