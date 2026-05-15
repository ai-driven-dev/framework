# 02 - Find agent

Enumerate installed agents across all plugins, capture the user's intent, recommend the best match with its invocation path.

## Inputs

- Free-form user intent (what they want delegated).
- Installed plugins available to the current AI tool.

## Outputs

A markdown table of installed agents + a recommendation block.

```text
| Plugin       | Agent       | Purpose                             |
| ------------ | ----------- | ----------------------------------- |
| aidd-dev     | implementer | Code milestones from a handed plan  |
| aidd-dev     | reviewer    | Independent critic in fresh context |
| ...          | ...         | ...                                 |

Recommendation: <best-match agent name>
Why: <one sentence>
Invoke with: Agent(subagent_type="<name>", ...)
```

## Process

1. **Enumerate installed agents.** Use the AI tool's native agent discovery to list every agent file. Exclude files under `assets/`, `templates/`, `references/`, or any file whose name matches `*-template.md` or `*.example.md`.
2. **Extract metadata.** Read `name` and `description` from the frontmatter of each agent file. Skip entries whose `name` or `description` contains placeholder syntax (`<...>`, `{{...}}`) and log them as template artifacts.
3. **Render the table.** Columns: `Plugin | Agent | Purpose`. Sort by plugin then agent name. One row per agent.
4. **Ask the user for intent.** `What do you need delegated?` Wait for an explicit reply.
5. **Match.** Pick the single best agent. If two are tied, list both.
6. **Print the recommendation block.** Agent name, one-sentence rationale, invocation pattern.
7. **Stop.** Do not invoke the agent.

## Test

The output contains a non-empty agents table matching what the AI tool actually has installed, followed by a recommendation block that names one agent present in the table, a one-line rationale, and an invocation pattern.
