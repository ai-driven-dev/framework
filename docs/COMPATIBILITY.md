# Compatibility

What each AI tool receives from the framework. The support tables are generated from the CLI's tool profiles, so they follow the code. Planned: Antigravity and Mistral Vibe.

## Support

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Registered through |
| --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | yes | yes | `claude` command line |
| Cursor | `.cursor/` | yes | yes | files written by `aidd` |
| GitHub Copilot | `.github/` | yes | yes | `copilot` command line |
| OpenCode | `.opencode/` | no | yes | files written by `aidd` |
| Kilo Code | `.kilo/` | no | yes | files written by `aidd` |
| Codex | `.codex/` | yes | yes | `codex` command line |

| Tool | Layout | Skills | Agents | MCP | Hooks | Rules | Commands |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | marketplace | yes | yes | yes | yes | no | no |
| Claude Code | flat files | yes | yes | yes | yes | no | no |
| Cursor | marketplace | yes | yes | yes | yes | no | no |
| Cursor | flat files | yes | yes | yes | yes | no | no |
| GitHub Copilot | marketplace | yes | yes | yes | yes | no | no |
| GitHub Copilot | flat files | yes | yes | yes | yes | no | no |
| OpenCode | flat files | yes | yes | no | bridge | no | no |
| Kilo Code | flat files | yes | yes | no | bridge | no | no |
| Codex | marketplace | yes | yes | yes | yes | no | no |
| Codex | flat files | yes | yes | no | yes | no | no |

<!--support:end-->

- `yes`: the build carries it in the tool's own format.
- `no`: the build skips it.
- `bridge`: the tool has no hooks file, so `aidd` generates a small plugin that replays the hooks.
- **Marketplace** builds are registered with the tool's plugin manager. **Flat files** builds are copied into the project.
- **Registered through**: for a tool with a command line, `aidd` drives it to register the marketplace and plugins. For the others, `aidd` writes the files itself.

Release archives and `aidd translate` follow these rows.

## Hooks

The bundled hooks and their events: [Architecture](ARCHITECTURE.md#-bundled-hooks).

| Tool | How the hooks reach it |
| --- | --- |
| Claude Code | A `hooks.json` file, the format hooks are written in. |
| Codex | A `hooks.json` file. Codex runs a hook only after a person approves it, once, in an interactive session. |
| GitHub Copilot | A `hooks.json` file in Copilot's format. |
| Cursor | A hooks file in Cursor's own format. |
| OpenCode, Kilo Code | A generated plugin in `.opencode/plugin/` or `.kilo/plugin/` replays `SessionStart`, `Stop` and `PostToolUse`. Other events do not run there. |

## Tested with

| Tool | Version | What was run |
| --- | --- | --- |
| Claude Code | 2.1.311 | Add the marketplace archive, install a plugin (user scope) |
| GitHub Copilot CLI | 1.0.83 | Add the marketplace archive, install a plugin (loaded from the unzipped folder) |
| Codex | 0.164.0 | Add the marketplace archive, add a plugin (copied into Codex's cache) |
| OpenCode | 1.19.4 | Flat archive: 51 skills, 2 agents and 2 plugins listed |
| Kilo Code | 7.8.18 | Flat archive: 51 skills, 2 agents and 2 plugins listed. The first start needs network access |

All runs used the 5.13.0 release archives in a temporary home. CI also runs Claude Code's own `plugin validate` on every build.
