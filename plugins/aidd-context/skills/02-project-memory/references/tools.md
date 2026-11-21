# Tools

| Tool | Detected when | Context file |
| --- | --- | --- |
| claude | `.claude/` or `CLAUDE.md` | `CLAUDE.md` |
| codex | `.codex/` | `AGENTS.md` |
| cursor | `.cursor/` or `.cursorrules` | `AGENTS.md` |
| opencode | `.opencode/` | `AGENTS.md` |
| kilo | `.kilo/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json`, `.kilo/kilo.jsonc`, or `.kilocode/` | `AGENTS.md` |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` | `AGENTS.md` |
| copilot | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `AGENTS.md` |

- A shared `AGENTS.md` is a wiring target, never a detection signal.
- Shared `.agents/` paths resolve from declared tools or the AIDD manifest, else ask which host.
- Kilo project memory uses the shared root `AGENTS.md`; new Kilo artifacts use `.kilo/`. An `AGENTS.md` alone does not detect Kilo, and neither does `opencode.json[c]` alone. Kilo may still read OpenCode-named config files for legacy compatibility. Sources: [Kilo settings](https://kilo.ai/docs/getting-started/settings), [AGENTS.md](https://kilo.ai/docs/customize/agents-md), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md), verified 2026-09-25.
- Setup picks the answer's `tools:` list, else the detected tools.
- Read `tools: claude, codex` or "wire it into claude" as the tools picked.
- On a refresh, a tool is wired when its context file holds a block, the old `<aidd_project_memory>` tag included.
- On a refresh, name the detected tools not yet wired; silence keeps the wiring.
