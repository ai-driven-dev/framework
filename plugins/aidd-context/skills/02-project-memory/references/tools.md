# Tools

| Tool     | Path hint                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json`                       | `AGENTS.md`                       |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md` |

- Shared `AGENTS.md` and `.agents/` do not identify a host; use declared tools or the AIDD manifest, otherwise ask.
- Tools sharing a context file wire it once; the block serves them all.
- A context file carries the block under a `## Memory Management` section, shaped like `assets/templates/AGENTS.md`.
- An existing context file keeps everything else: add only what is missing.
- Touch no context file a picked tool does not resolve to.
