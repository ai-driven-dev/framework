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
- Create an absent context file from [AGENTS.md](../assets/templates/AGENTS.md).
- A picked tool whose context file's AIDD structure differs still gets its marker pair; offer to reconcile the rest, applying only what the person approves.
- Copilot's own file holds one line pointing to `AGENTS.md`: created when absent, other content kept, a memory block replaced by that line.
- Setup picks the answer's `tools:` list, else the detected tools; ask with the other questions, never again.
- Read `tools: claude, codex` or "wire it into claude" as the tools picked.
- On a refresh, a tool is wired when its context file holds a block, the old `<aidd_project_memory>` tag included.
- On a refresh, name the detected tools not yet wired; silence keeps the wiring.
