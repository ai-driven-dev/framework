# Hosts

Where each host AI tool keeps a project's slash commands, and how to tell it is installed.

| Host / ID | Detected when | Command file |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | `.claude/commands/<name>.md` |
| Cursor / `cursor` | `.cursor/` | `.cursor/commands/<name>.md` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md`, `.github/instructions/` or `.github/prompts/` | `.github/prompts/<name>.prompt.md` |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | `.opencode/commands/<name>.md` |
| Kilo Code / `kilo` | `.kilo/` | `.kilo/commands/<name>.md` |

Every host reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

Codex CLI and Antigravity keep no project command: Codex reads prompts only from `~/.codex/prompts/`, and both deprecate them for skills.

A plugin source is one canonical command, in the Claude Code format, where the target tool's plugin format puts commands, with no per-host copy.

Facts the writer cannot enforce:

- Claude Code merged commands into skills, Cursor calls its commands legacy, and Copilot deprecates its local prompt files.
- Copilot does not substitute `$ARGUMENTS`, and Cursor documents neither frontmatter nor argument placeholders.
- Commands are written flat, one file per name, with no subfolder.

Sources: [Claude](https://code.claude.com/docs/en/slash-commands), [Cursor](https://cursor.com/help/customization/skills), [Copilot](https://code.visualstudio.com/docs/agent-customization/prompt-files), [OpenCode](https://opencode.ai/docs/commands/), [Kilo](https://kilo.ai/docs/customize/workflows), [Codex](https://learn.chatgpt.com/docs/custom-prompts).
