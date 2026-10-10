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
| Kilo           | `.kilo/agents/<name>.md`         | markdown + frontmatter |

Agents are supported on all six tools. Kilo's canonical plural path is sourced from https://kilo.ai/docs/customize/custom-subagents (issue #914 contract verified 2026-09-25; source rechecked 2026-10-10).

## Frontmatter per tool

The canonical agent carries `name` and `description`. Emit those a row accepts, drop the rest. Optional fields, including `model`, only if the user asked. Never invent a value.

| Tool           | Accepts                                                      |
| -------------- | ----------------------------------------------------------- |
| Claude Code    | `name`, `description`, optional `model`, `color`, `tools`   |
| Cursor         | `name`, `description`, optional `model`, `readonly`, `is_background` |
| OpenCode       | `name`, `description`, optional `model`, `temperature`, `permission` |
| GitHub Copilot | `name`, `description`, optional `model`, `tools`            |
| Codex CLI      | `name`, `description` (drops `model`)                       |
| Kilo           | `description`, `mode: subagent`, requested `model`, `temperature`, `permission` |

For Kilo, the name is the filename. Do not emit the Claude `name` field. Its supported permission field is singular and maps requested tools or patterns to `allow`, `ask`, or `deny`. Emit `mode: subagent` and an optional field only when requested; never invent a default.

## Codex TOML conversion

Codex agents are TOML, not markdown. Convert:

- Each frontmatter field becomes a top-level TOML key. Quote every string value with `"double quotes"` (a TOML basic string) and escape any embedded `"` or backslash, so a quote or apostrophe in the description stays valid TOML.
- The body becomes `developer_instructions`, wrapped in `'''` literal delimiters (no escaping of the markdown).
- Drop `model`.

## Detect (which tools are installed)

| Signal                            | Tool(s)                               |
| --------------------------------- | ------------------------------------- |
| `.claude/` or `CLAUDE.md`         | Claude Code                           |
| `.cursor/`                        | Cursor                                |
| `.opencode/`                      | OpenCode                              |
| `.codex/`                         | Codex CLI                             |
| `.github/copilot-instructions.md` | GitHub Copilot                        |
| `AGENTS.md`                       | Cursor, OpenCode, or Codex (list all) |
| `.kilo/`, `kilo.json`, `kilo.jsonc`, `.kilo/kilo.json`, `.kilo/kilo.jsonc`, or `.kilocode/` | Kilo |

The six Kilo signals are shared with the Kilo skill contract. `AGENTS.md` and `opencode.json[c]` alone are not Kilo signals. `.kilocode/` detects legacy Kilo but new output remains under `.kilo/`.

## Write targets

- **Host project**: one file per confirmed tool, at the paths above.
- **Plugin source**: one canonical agent at `plugins/<plugin>/agents/<name>.md`. No per-tool fan-out.

The mode is chosen in the capture action. Never pick one silently.

## Safety checks

- **Asset-access precheck.** Before writing, confirm this reference is readable. If not, stop: the plugin is not installed in this host.
- **Write-target validation.** After writing, confirm every path is relative, under the workspace, and at the chosen scope. Otherwise stop and report the bad path.
- **Publication preflight.** Before creating a directory or file, resolve every selected target and its references. Refuse a path outside the workspace, a symlink or non-regular collision, a non-writable target, an existing user agent that was not explicitly selected for modify, unknown Kilo fields, or a target whose state changed after preflight. A refusal leaves every selected target unchanged. Skip byte-identical writes, so a confirmed rerun preserves bytes and mtime.
