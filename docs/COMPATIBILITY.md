# Compatibility

What each AI tool receives from the framework. The table is generated from the CLI's tool profiles, so it follows the code.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ bridge |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ bridge |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | ✅ marketplace, ❌ flat files | ✅ |

<!--support:end-->

✅ supported · ❌ not supported · bridge: the tool has no hooks file, so `aidd` generates a small plugin that replays the hooks.

- Codex runs a hook only after you approve it once, in an interactive session.
- On OpenCode and Kilo Code, the bridge replays `SessionStart`, `Stop` and `PostToolUse`. Other events do not run there.

To install, see the [install guide](INSTALL.md). Planned: Antigravity and Mistral Vibe.
