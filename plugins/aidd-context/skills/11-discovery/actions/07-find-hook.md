# 07 - Find hook

Enumerate installed hooks across every confirmed tool's hook surfaces, recommend the best match for the user's stated intent.

## Inputs

- Free-form user intent.
- Confirmed tools from the SKILL.md tool gate.

## Outputs

A markdown table of installed hooks + a recommendation block.

```text
| Plugin       | Event              | Trigger / Matcher              | Script                                    | Purpose                              |
| ------------ | ------------------ | ------------------------------ | ----------------------------------------- | ------------------------------------ |
| aidd-refine  | UserPromptSubmit   | /condense-stats, token savings | hooks/condense-stats.js                   | Show session token savings           |
| aidd-context | SessionStart       | -                              | hooks/update_memory.js                    | Refresh memory bank on session start |
| ...          | ...                | ...                            | ...                                       | ...                                  |

Recommendation: <plugin> · <event>
Why: <one sentence>
Source: <relative path to hooks.json or settings.json>
```

## Process

1. **Enumerate hooks.** For each confirmed tool, scan its hook surface(s) and parse each per the format noted in `@../references/ai-mapping.md` (project/user hook config, plugin-bundled `hooks/hooks.json`, or a JS module). Tag each row with its owning tool.
2. **Extract metadata.** For each registered hook, capture owning plugin (or `project`), event name, trigger pattern or matcher, script path, and a one-line purpose drawn from the script's header comment when present.
3. **Render the table.** Columns: `Plugin | Event | Trigger / Matcher | Script | Purpose`. Sort by event then plugin.
4. **Ask the user for intent.** `Which event or behavior do you want to intercept?` Wait for an explicit reply.
5. **Match.** Score each hook against the stated intent (event + trigger + purpose). Pick the single best match.
6. **Print the recommendation block.** Plugin + event, one-sentence rationale, source path.
7. **Stop.** Do not enable, disable, or invoke the hook.

## Test

The output contains a non-empty hooks table whose rows match what is registered in scanned `hooks.json` and settings files, followed by a recommendation block that names one hook present in the table, a one-line rationale, and its source path.
