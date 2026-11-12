← [aidd-framework](../../README.md)

# aidd-context

Project knowledge: memory, context files and generators.

| | |
| --- | --- |
| Status | stable |
| Install | `/plugin install aidd-context@aidd-framework` |
| Start with | `/aidd-context:00-onboard` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-context) |

## Hooks

| Event | When | Does |
| --- | --- | --- |
| `SessionStart` | a session opens | refreshes the memory block of each context file, silently, so a new memory file is loaded |
| `Stop` | the model ends its turn | if the bank changed since the last check, tells the model which memory lines are gone and what breaks a rule, and shows the person the same, once |

`SessionStart` runs `hooks/memory.cjs load`, `Stop` runs `hooks/memory.cjs guard`. Every tool in [Compatibility](../../docs/COMPATIBILITY.md) with hooks receives them; Antigravity receives `SessionStart` only, so no lost line is reported there. A missing always-written file is the skill's: its script creates it from the template.

Limit: a line counts as lost only when its trimmed text is absent from every bank file; a reworded line is reported, a moved one is not. The bank as the session found it is kept in the repository's git folder, so outside a git repository no lost line is reported.
