# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | Marketplace only | ✅ |
| Antigravity CLI | `.agents/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Kimi Code CLI | `.kimi-code/` | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Marketplace only | Supported when installed through the tool's marketplace, not as flat files |
| Some events | Only `SessionStart`, `Stop` and `PostToolUse` |

## Kimi Code CLI limits

- Hooks: Kimi reads hooks only from `[[hooks]]` in the user-level `~/.kimi-code/config.toml`, never from a project. A build warns and ships none.
- Agent `tools`: written only when the source declares them, as Kimi names (`WebFetch` becomes `FetchURL`, `Task` becomes `Agent`). A Claude tool with no Kimi name is dropped, which narrows the grant. `model` is not written.
- MCP: written by the flat build to `.kimi-code/mcp.json`. The install does not merge MCP servers for Kimi. A project-level stdio server runs only in a trusted folder.
- An MCP command that names a script under the plugin's `hooks/` folder finds no script: a build copies only the folders the tool has a place for, and Kimi has none for hooks. No shipped plugin does this.
- Skills sit in `.agents/skills/`, shared with Codex and Antigravity.
- Kimi also scans `.agents/agents/`, so in a project built for Antigravity and Kimi, Kimi also sees the Antigravity agents, whose tool names it does not know. Which folder wins is undocumented and not measured, since Kimi is never run here. The two agent files stay separate on purpose: one `tools` list mixing both vocabularies makes an Antigravity subagent fail to start (`unknown component: tool "Read" not found in registry`) while the CLI still exits 0.
- Never run against a live Kimi session by this project.
