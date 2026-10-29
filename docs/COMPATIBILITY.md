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
| 🟡 | Supported with some install methods only |
| 🔌 | Partial: only `SessionStart`, `Stop` and `PostToolUse` |
