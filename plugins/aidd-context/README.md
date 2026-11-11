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
| `PostToolUse` | after the model writes a file or runs a shell command | checks the memory lines it changed and tells the model what breaks a rule; never blocks |
| `Stop` | the turn ends, once | lists the memory lines lost since the last commit that no sheet line approved, and asks the model to tell the person, restoring a line only if they ask |

All run `hooks/memory.cjs hook`. Every tool in [Compatibility](../../docs/COMPATIBILITY.md) with hooks receives them. A missing always-written file is not the hook's: `check`, run by the project memory skill, fails on it.
