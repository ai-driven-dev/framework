# 04 - Find plugin

Enumerate installed plugins, summarize each one's scope, and recommend the plugin that best fits the user's high-level intent.

## Inputs

- Free-form user intent (broad goal, not a specific skill).
- Installed plugins available to the current AI tool.

## Outputs

A markdown table of installed plugins + a recommendation block.

```text
| Plugin             | Scope                                                 |
| ------------------ | ----------------------------------------------------- |
| aidd-context       | Onboarding, memory bank, context generation, mermaid  |
| aidd-dev           | Dev SDLC: spec / plan / implement / review            |
| aidd-vcs           | Commit, PR, release tag, issue                        |
| ...                | ...                                                   |

Recommendation: <best-match plugin>
Why: <one sentence>
Next step: see the plugin's onboard or skill list via `01-find-skill`.
```

## Process

1. **Enumerate installed plugins.** Use the AI tool's native plugin discovery to list every enabled plugin.
2. **Extract metadata.** Read the plugin's `plugin.json` (or equivalent) for `name` and `description`. Fall back to the plugin's README or CATALOG for a one-line scope.
3. **Render the table.** Columns: `Plugin | Scope`. One row per plugin.
4. **Ask the user for intent.** `What are you trying to achieve at a high level?` Wait for an explicit reply.
5. **Match.** Pick the single best plugin. If two are tied, list both.
6. **Print the recommendation block.** Plugin name, one-sentence rationale, suggested next step (drill into the plugin via `01-find-skill`).
7. **Stop.** Do not invoke anything.

## Test

The output contains a non-empty plugins table matching what the AI tool actually has installed, followed by a recommendation block that names one plugin present in the table, a one-line rationale, and a concrete next step.
