# Tools

| Tool | Detected when | Context file |
| --- | --- | --- |
| claude | `.claude/` or `CLAUDE.md` | `CLAUDE.md` |
| codex | `.codex/` | `AGENTS.md` |
| cursor | `.cursor/` or `.cursorrules` | `AGENTS.md` |
| opencode | `.opencode/` | `AGENTS.md` |
| antigravity | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` | `AGENTS.md` |
| copilot | `.github/copilot-instructions.md` or `.github/{instructions,agents,skills,prompts}/` | `AGENTS.md` |

- A shared `AGENTS.md` is a wiring target, never a detection signal.
- Shared `.agents/` paths resolve from declared tools or the AIDD manifest, else ask which host.
- A wired context file whose AIDD structure differs from [AGENTS.md](../assets/templates/AGENTS.md): offer to reconcile it, applying only what the person approves.
- Copilot's own file holds one line pointing to `AGENTS.md`.
- Setup picks the answer's `tools:` list, else the detected tools; ask with the other questions, never again.
- Read `tools: claude, codex` or "wire it into claude" as the tools picked.
- On a refresh, a tool is wired when its context file holds a block, the old `<aidd_project_memory>` tag included.
- On a refresh, name the detected tools not yet wired; silence keeps the wiring.
