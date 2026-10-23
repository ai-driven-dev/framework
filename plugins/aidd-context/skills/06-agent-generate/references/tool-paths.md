# Tool paths (agents)

The per-tool agent path and the gate every run executes before writing. Agent slice only, nothing about skills, rules, commands, hooks, plugins, or marketplaces.

## Agent path per tool

| Tool           | Path                             | Format                 |
| -------------- | -------------------------------- | ---------------------- |
| Claude Code    | `.claude/agents/<name>.md`       | markdown + frontmatter |
| Cursor         | `.cursor/agents/<name>.md`       | markdown + frontmatter |
| OpenCode       | `.opencode/agents/<name>.md`     | markdown + frontmatter |
| GitHub Copilot | `.github/agents/<name>.agent.md` | markdown + frontmatter |
| Codex CLI      | `.codex/agents/<name>.toml`      | TOML (converted)       |

Agents are supported on all five tools.

User-level agents, for every project of the user: Claude Code `~/.claude/agents/` (`CLAUDE_CONFIG_DIR`), Codex `~/.codex/agents/` (`CODEX_HOME`), OpenCode `~/.config/opencode/agents/` (`XDG_CONFIG_HOME`), Copilot `~/.copilot/agents/<name>.agent.md` (`COPILOT_HOME`). Cursor documents `~/.cursor/agents/`, but its CLI 2026.10.19 loaded none from there; prefer the project path. Sources: [Claude](https://code.claude.com/docs/en/sub-agents), [Codex](https://developers.openai.com/codex/subagents), [OpenCode](https://opencode.ai/docs/agents), [Copilot](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference), [Cursor](https://cursor.com/docs/subagents).

Cursor keeps single quotes as part of a frontmatter value: quote Cursor values with `"double quotes"` or not at all.

## Frontmatter per tool

The canonical agent carries `name` and `description`. Emit those a row accepts, drop the rest. Add model or effort settings only when requested and supported.

| Tool           | Accepts                                                      |
| -------------- | ----------------------------------------------------------- |
| Claude Code    | `name`, `description`, optional `model`, `effort`, `color`, `tools` |
| Cursor         | `name`, `description`, optional `model`, `readonly`, `is_background` |
| OpenCode V2    | `description`, `mode: subagent`, optional `model` as `provider/model#variant`, `permissions` as a list of `action`, `resource`, `effect` rules. No `name`: the file name is the ID, and with `name` OpenCode 2.1.2 ignores `permissions` |
| GitHub Copilot | `name`, `description`, optional `model`, `reasoningEffort`, `tools`, `include-custom-instructions` |
| Codex CLI      | `name`, `description`, optional `model`, `model_reasoning_effort` |

Write OpenCode agents for V2 only: V2 still loads V1 definitions, and treats their `tools` and `permission` fields as legacy.

Copilot subagents skip `AGENTS.md` and other repository instructions unless `include-custom-instructions: true`; set it by default.

Sources: [Claude](https://code.claude.com/docs/en/sub-agents#frontmatter-reference), [Cursor](https://cursor.com/docs/subagents#file-format), [OpenCode V2](https://opencode.ai/v2/docs/agents#options), [V1 compatibility](https://opencode.ai/v2/docs/migrate-v1), [Copilot](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#custom-agent-frontmatter-fields), [Codex](https://developers.openai.com/codex/subagents#custom-agent-file-schema).

## Codex TOML conversion

Codex agents are TOML, not markdown. Convert:

- Each frontmatter field becomes a top-level TOML key. Quote every string value with `"double quotes"` (a TOML basic string) and escape any embedded `"` or backslash, so a quote or apostrophe in the description stays valid TOML.
- The body becomes `developer_instructions`, wrapped in `'''` literal delimiters (no escaping of the markdown).

## Detect (which tools are installed)

| Signal                            | Tool(s)                               |
| --------------------------------- | ------------------------------------- |
| `.claude/` or `CLAUDE.md`         | Claude Code                           |
| `.cursor/`                        | Cursor                                |
| `.opencode/`                      | OpenCode                              |
| `.codex/`                         | Codex CLI                             |
| `.github/copilot-instructions.md` | GitHub Copilot                        |
| `AGENTS.md`                       | Cursor, OpenCode, or Codex (list all) |

## Write targets

- **Host project**: one file per confirmed tool, at the paths above.
- **Plugin source**: one canonical agent at `plugins/<plugin>/agents/<name>.md`. No per-tool fan-out.

The mode is chosen in the capture action. Never pick one silently.

## Safety checks

- **Asset-access precheck.** Before writing, confirm this reference is readable. If not, stop: the plugin is not installed in this host.
- **Write-target validation.** After writing, confirm every path is relative, under the workspace, and at the chosen scope. Otherwise stop and report the bad path.
