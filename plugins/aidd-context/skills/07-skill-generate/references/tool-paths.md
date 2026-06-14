# Tool paths (skills)

The per-tool skills path and write targets. Skill slice only, nothing about rules, hooks, plugins, or marketplaces.

## Skills path per tool

| Tool           | Path                                  |
| -------------- | ------------------------------------- |
| Claude Code    | `.claude/skills/<name>/SKILL.md`      |
| Cursor         | `.cursor/skills/<name>/SKILL.md`      |
| OpenCode       | `.opencode/skills/<name>/SKILL.md`    |
| GitHub Copilot | `.github/skills/<name>/SKILL.md`      |
| Codex CLI      | `.agents/skills/<name>/SKILL.md`      |

Codex skills live under `.agents/` (not `.codex/`), one folder per skill. Verified: a plain `<name>` folder is discovered, no `aidd-` prefix.

## Frontmatter per tool

Emit the fields each row accepts:

- Always `description`. `name` only where the row lists it (some tools derive it from the folder).
- Drop an unsupported field. Never invent a substitute.
- A permission field (`allowed-tools`, `permission`) stays omitted unless the user restricts tools.
- A manual-only flag exists only where a row lists one. No row, no manual-only, so tell the user.

| Tool           | Accepts                                                           |
| -------------- | ----------------------------------------------------------------- |
| Claude Code    | `name`, `description`, optional `allowed-tools`, `disable-model-invocation` |
| Cursor         | `name`, `description`, optional `allowed-tools`                    |
| GitHub Copilot | `name`, `description`, optional `allowed-tools`                    |
| OpenCode       | `description`, `permission` (a `{tool: allow\|ask\|deny}` map; omit unless the skill restricts a tool. `name` comes from the folder) |
| Codex CLI      | `name`, `description` (strips `argument-hint`, `model`, `docs`)    |

## Detect (which tools are installed)

| Signal                            | Tool(s)                               |
| --------------------------------- | ------------------------------------- |
| `.claude/` or `CLAUDE.md`         | Claude Code                           |
| `.cursor/`                        | Cursor                                |
| `.opencode/`                      | OpenCode                              |
| `.codex/`                         | Codex CLI                             |
| `.github/copilot-instructions.md` | GitHub Copilot                        |
| `AGENTS.md`                       | Cursor, OpenCode, or Codex (list all) |

Several signals can be present at once.

## Write targets

- **Host project**: one file per confirmed tool, at the paths above.
- **Plugin source**: one canonical skill at `plugins/<plugin>/skills/<name>/SKILL.md`. No per-tool fan-out. Per-tool resolution happens at install.

The mode is chosen in the capture action. Never pick one silently.

## Safety checks

- **Asset-access precheck**: before writing, confirm this reference is readable. If not, stop: the plugin is not installed in this host. Do not guess paths.
- **Write-target validation**: after writing, confirm every path is relative, under the workspace, never under the plugin install directory, and under the chosen scope. Otherwise stop and report the bad path.
