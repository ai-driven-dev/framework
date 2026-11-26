← [aidd-framework](../../README.md)

# aidd-context

Project knowledge: memory, context files and generators.

| | |
| --- | --- |
| Status | stable |
| Install | [Add the Claude Code marketplace](../../docs/INSTALL.md#marketplace), then run `/plugin install aidd-context@aidd-marketplace` |
| Start with | `/aidd-context:00-onboard` |
| Skills, agents, hooks | [Catalog](../../docs/CATALOG.md#-aidd-context) |

## Hooks

| Event | When | Does |
| --- | --- | --- |
| `SessionStart` | a session opens | refreshes the memory block of each context file, silently, so a new memory file is loaded |
| `Stop` | the model ends its turn | refreshes the same blocks; names a context file it could not refresh while that file misses a memory file |

`SessionStart` runs `hooks/memory.cjs load`, `Stop` runs `hooks/memory.cjs sync`. Which tools run them, per event, is in [Compatibility](../../docs/COMPATIBILITY.md#hook-events). A missing always-written file is the skill's: its script creates it from the template.

The hook keeps no state and lints nothing. The skill checks the memory it writes with its own script, against the lines written since the bank's last commit.
