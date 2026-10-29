# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ❌ | 🔌 |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ❌ | 🔌 |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |

<!--support:end-->

| Symbol | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| 🟡 | Only with some install methods |
| 🔌 | Through a generated plugin that replays the hooks |

- Codex runs a hook only after you approve it once, in an interactive session.
- OpenCode and Kilo Code replay `SessionStart`, `Stop` and `PostToolUse` only.
