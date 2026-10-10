# Tools

The AI tools a project can use.

| Tool     | Detected when                                                                        | Context file                      |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| claude   | `.claude/` or `CLAUDE.md`                                                            | `CLAUDE.md`                       |
| codex    | `.codex/`                                                                            | `AGENTS.md`                       |
| cursor   | `.cursor/` or `.cursorrules`                                                         | `AGENTS.md`                       |
| opencode | `.opencode/`                                                                         | `AGENTS.md`                       |
| kilo     | `.kilo/` or `kilo.json` or `kilo.jsonc` or `.kilo/kilo.json` or `.kilo/kilo.jsonc` or `.kilocode/` | `AGENTS.md`             |
| copilot  | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `.github/copilot-instructions.md` |

- A shared `AGENTS.md` is a wiring target, never a detection signal.
- Tools sharing a context file wire it once; the block serves them all.
- A context file carries the block under a `## Memory Management` section, shaped like `assets/templates/AGENTS.md`.
- An existing context file keeps everything else: add only what is missing.
- Touch no context file a picked tool does not resolve to.

Kilo: `.kilocode/` is a legacy detection signal only. New Kilo-specific artifacts use `.kilo/`, never `.kilocode/`. Neither `opencode.json` nor `opencode.jsonc` identifies Kilo; OpenCode detection remains the row above.

Kilo path sources: [configuration](https://kilo.ai/docs/getting-started/settings), [shared memory](https://kilo.ai/docs/customize/agents-md), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md). Verified on 2026-09-25 according to issue #914; reverified on 2026-10-10.
