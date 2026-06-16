# 04 - Find plugin

Enumerate installed plugins, summarize each one's scope, and recommend the plugin that best fits the user's high-level intent.

## Inputs

- Free-form user intent (broad goal, not a specific skill).
- Confirmed tools from the SKILL.md tool gate.

## Outputs

A markdown table of installed plugins + a recommendation block.

```text
| Tool   | Plugin             | Scope                                                 |
| ------ | ------------------ | ----------------------------------------------------- |
| claude | aidd-context       | Onboarding, memory bank, context generation, mermaid  |
| claude | aidd-dev           | Dev SDLC: spec / plan / implement / review            |
| claude | aidd-vcs           | Commit, PR, release tag, issue                        |
| ...    | ...                | ...                                                   |

Recommendation: <best-match plugin>
Why: <one sentence>
Next step: see the plugin's onboard or skill list via `01-find-skill`.
```

## Process

1. **Enumerate plugins.** For each confirmed tool, list enabled plugins from its plugin install location(s) in `@../references/ai-mapping.md`.
2. **Extract metadata.** Read the plugin's `plugin.json` (or equivalent) for `name` and `description`. Fall back to the plugin's README or CATALOG for a one-line scope.
3. **Render the table.** Columns: `Tool | Plugin | Scope`. Sort by tool then plugin. One row per plugin.
4. **Ask the user for intent.** `What are you trying to achieve at a high level?` Wait for an explicit reply.
5. **Match.** Pick the single best plugin. If two are tied, list both.
6. **Print the recommendation block.** Plugin name, one-sentence rationale, suggested next step (drill into the plugin via `01-find-skill`).
7. **Stop.** Do not invoke anything.

## Test

The output contains a non-empty plugins table matching what the AI tool actually has installed, followed by a recommendation block that names one plugin present in the table, a one-line rationale, and a concrete next step.
