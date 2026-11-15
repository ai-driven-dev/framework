# Hosts

Where each host AI tool keeps a project's slash commands, and how to tell it is installed.

| Host / ID | Detected when | Command file | Keys kept |
| --- | --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | `.claude/commands/<name>.md` | `description`, `argument-hint`, `model`, `allowed-tools`, `disable-model-invocation` |
| Cursor / `cursor` | `.cursor/` | `.cursor/commands/<name>.md` | none, body only |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md`, `.github/instructions/` or `.github/prompts/` | `.github/prompts/<name>.prompt.md` | `description`, `argument-hint`, `agent`, `model` |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | `.opencode/commands/<name>.md` | `description`, `agent`, `model` |
| Kilo Code / `kilo` | `.kilo/` | `.kilo/commands/<name>.md` | `description`, `agent`, `model` |

Every host reads `AGENTS.md`, so it signals none. When no signal matches, confirm the host.

Codex CLI and Antigravity keep no project command: Codex reads prompts only from `~/.codex/prompts/`, and both deprecate them for skills. For either, generate a skill instead.

A plugin source is one canonical command, in the Claude Code format, where the target tool's plugin format puts commands, with no per-host copy.

The writer renders each host's keys. Facts it cannot enforce:

- Claude Code merged commands into skills, Cursor calls its commands legacy, and Copilot deprecates its local prompt files: prefer a skill for anything that may grow.
- Copilot does not substitute `$ARGUMENTS`; the text after `/<name>` reaches the model as chat input.
- Cursor documents neither frontmatter nor argument placeholders for a command.
- Commands are written flat, one file per name, with no subfolder.

Sources: [Claude](https://code.claude.com/docs/en/slash-commands), [Cursor](https://cursor.com/help/customization/skills), [Copilot](https://code.visualstudio.com/docs/agent-customization/prompt-files), [OpenCode](https://opencode.ai/docs/commands/), [Kilo](https://kilo.ai/docs/customize/workflows), [Codex](https://learn.chatgpt.com/docs/custom-prompts).
