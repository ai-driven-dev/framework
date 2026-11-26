# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks | Rules |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ✅ | Some events | ✅ |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ✅ | Some events | ✅ |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Antigravity CLI | `.agents/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Kiro | `.kiro/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kimi Code CLI | `.kimi-code/` | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Marketplace only | Supported when installed through the tool's marketplace, not as flat files |
| Some events | Through a generated bridge: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse` and `Stop` |

## Hook events

What an event can do per host is in [hosts.md](../plugins/aidd-context/skills/08-hook-generate/references/hosts.md). The event map is in `cli/src/composition/tool-profiles/`.

| Host | SessionStart | UserPromptSubmit | PreToolUse | PostToolUse | Stop | SessionEnd | SubagentStop | Refuse a write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | yes | yes | yes | yes | yes | yes | yes | yes |
| Codex | yes | yes | yes | yes | yes | yes | yes | yes |
| GitHub Copilot | yes | yes | yes | yes | yes | yes | yes | yes |
| Cursor | yes | yes | yes | yes | yes | no | yes | no |
| OpenCode | yes | yes | yes | yes | yes | no | no | yes |
| Kilo Code | yes | yes | yes | yes | yes | no | no | yes |
| Antigravity CLI | yes | no | yes | yes | yes | no | no | yes |
| Kiro | yes | yes | yes | yes | yes | no | yes | yes |
| Kimi Code CLI | no | no | no | no | no | no | no | no |

yes: the CLI writes the event to the host's hook file or bridge. no: it drops the event, and a build warns where it can.

Sources: [Claude Code](https://code.claude.com/docs/en/hooks), [Codex](https://learn.chatgpt.com/docs/hooks), [Copilot](https://docs.github.com/en/copilot/reference/hooks-configuration), [Cursor](https://cursor.com/docs/agent/hooks), [Antigravity](https://antigravity.google/docs/hooks), [Kiro](https://kiro.dev/docs/hooks/types/).

## Limits

### Antigravity CLI

- A matcher is a `|` list of `agy` tool names (`edit_file`); a regular-expression part selects nothing.
- A `PostToolUse` answer does not reach the model.
- A silent `PreToolUse` script answers `allow`, because `{}` denies.

### Cursor

- Only a project `.cursor/hooks.json` fires; a plugin-scope one fires nothing.
- `PostToolUse` takes `additional_context` only, so `decision: block` is dropped.
- A headless `cursor-agent -p` delivers no `stop`.

### OpenCode and Kilo Code

- A subagent's child session runs neither `SessionStart` nor `Stop`.
- One `Stop` hook per plugin: after one blocks, the next stay silent.
- A `SessionStart` script that exits 2 shows its stderr to the person only.

### Codex

- A project hooks file is skipped in an untrusted project.

### Kiro

- A matcher becomes Kiro's tool tags, one hook per tag.
- A `PostToolUse` script's output does not reach the model.

### Kimi Code CLI

- Hooks live only in the user-level `~/.kimi-code/config.toml`; a build ships none.
- A Claude agent tool with no Kimi name is dropped from `tools`.
- The install does not merge MCP servers; the flat build writes `.kimi-code/mcp.json`.
