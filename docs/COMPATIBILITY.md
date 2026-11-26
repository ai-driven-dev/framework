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
| Kimi Code CLI | `.kimi-code/` | ✅ | ✅ | ✅ | ✅ | Flat files only | ❌ | ❌ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Some events | Through a generated bridge; events in [Hook events](#hook-events) |

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

| Limit | What it means for you |
| --- | --- |
| A hook matcher takes only the tools Write, Edit and Bash, renamed to `agy`'s own | Any other tool name is dropped from the matcher |
| A `PostToolUse` answer is not relayed to the model | Do not use `PostToolUse` to feed the model |
| A silent `PreToolUse` script answers `allow` | Print a refusal to block; silence never does |
| A subagent's `tools` list keeps only tools with a name on the host | A Claude tool with no host name is dropped from its agent |

### Kimi Code CLI

| Limit | What it means for you |
| --- | --- |
| A subagent's `tools` list keeps only tools with a name on the host | A Claude tool with no host name is dropped from its agent |

### Cursor

| Limit | What it means for you |
| --- | --- |
| Only a project `.cursor/hooks.json` fires | A plugin-scope hooks file does nothing |
| `postToolUse` takes `additional_context` only, so `decision: block` is dropped ([hooks](https://cursor.com/docs/agent/hooks)) | A `PostToolUse` block does not stop Cursor |
| A headless `cursor-agent -p` run delivers no `stop` | A `Stop` hook such as a memory sync does not run headless |

### OpenCode and Kilo Code

| Limit | What it means for you |
| --- | --- |
| A subagent's child session runs neither `SessionStart` nor `Stop` | Hooks fire once per task, not per subagent |
| One `Stop` hook per plugin can continue a turn | After one blocks, the next stay silent |
| A `SessionStart` script that exits 2 has its stderr added to the model's system prompt | Claude Code shows it to the person only; do not exit 2 for a message |

### Codex

| Limit | What it means for you |
| --- | --- |
| A hook is skipped silently until a person trusts it | Approve it once in an interactive session, or pass `--dangerously-bypass-hook-trust` to `codex exec` |

### Kiro

| Limit | What it means for you |
| --- | --- |
| A tool matcher becomes Kiro's tool tags, one hook per tag | Only `PostToolUse` takes a matcher; `Write`, `Edit` and `Delete` map to `write`, the shell tools to `shell` |
| Text a `PostToolUse` hook prints was not seen reaching the model | Do not use `PostToolUse` to feed the model on Kiro |
