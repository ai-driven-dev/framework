# Tools

The AI tools a project can use.

| Tool     | Detected when                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json`                       | `AGENTS.md`                       |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `AGENTS.md`                       |

| Case | Do |
| --- | --- |
| A shared `AGENTS.md` | a wiring target, never a detection signal |
| Shared `.agents/` paths | resolve from declared tools or the AIDD manifest, else ask which host |
| Absent context file | create it from [AGENTS.md](../assets/templates/AGENTS.md) |
| Its AIDD structure differs | offer to reconcile it, applying only what the user approves; `--add` only once accepted or already following it |
| Copilot | its own file holds one line pointing to `AGENTS.md`: created when absent, other content kept, a memory block replaced by that line |
| Setup | the answer's `tools:` list, else the detected tools; asked with the sheet, never asked again |
| On a refresh | the tools whose context file already carries the block, the old `<aidd_project_memory>` tag included, and copilot when its own file holds the pointer or a block; nothing is asked |
| Rewire | ask alone, showing every tool with the detected ones ticked, and wait for the picks |
