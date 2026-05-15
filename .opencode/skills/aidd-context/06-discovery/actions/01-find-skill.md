# 01 - Find skill

Enumerate installed skills across all plugins, capture the user's intent, recommend the best match with its invocation path.

## Inputs

- Free-form user intent (what they want to accomplish).
- Installed plugins available to the current AI tool.

## Outputs

A markdown table of installed skills + a recommendation block.

```text
| Plugin       | Skill           | Purpose                           |
| ------------ | --------------- | --------------------------------- |
| aidd-context | 02:project-init | Bootstrap memory bank + scaffold  |
| aidd-dev     | 00:sdlc         | End-to-end dev SDLC orchestrator  |
| ...          | ...             | ...                               |

Recommendation: <best-match skill id>
Why: <one sentence>
Invoke with: /<skill-id>
```

## Process

1. **Enumerate installed skills.** Use the AI tool's native skill discovery to list every installed plugin and its skills.
2. **Extract metadata.** For each `SKILL.md`, read `name` and `description` from the frontmatter. Skip malformed entries and log them.
3. **Render the table.** Columns: `Plugin | Skill | Purpose`. Sort by plugin then skill id. One row per skill.
4. **Ask the user for intent.** `What do you want to accomplish?` Wait for an explicit reply.
5. **Match.** Score each skill against the stated intent. Pick the single best match. If two are clearly tied, list both.
6. **Print the recommendation block.** Chosen skill id, one-sentence rationale, exact invocation string.
7. **Stop.** Do not invoke the recommended skill.

## Test

The output contains a non-empty skills table whose rows match what the AI tool actually has installed, followed by a recommendation block that names one skill present in the table, a one-line rationale, and an invocation string.
