# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks | Rules |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events | ❌ |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events | ✅ |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | Marketplace only | ✅ | ❌ |
| Antigravity CLI | `.agents/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Kiro | `.kiro/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kimi Code CLI | `.kimi-code/` | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Marketplace only | Supported when installed through the tool's marketplace, not as flat files |
| Some events | Through a generated bridge, only `SessionStart`, `Stop` and `PostToolUse` |

## Hook events

Facts below were measured on the host versions named in [the payload fixtures](../scripts/__tests__/fixtures/hook-payloads/README.md); "unverified" means not observed. What an event can do per host is in [hosts.md](../plugins/aidd-context/skills/08-hook-generate/references/hosts.md).

| Host | SessionStart | UserPromptSubmit | PreToolUse | PostToolUse | Stop | SessionEnd | SubagentStop |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | yes | yes | yes | yes | yes | yes | yes |
| Codex | yes | yes | yes | yes | yes | yes | yes |
| GitHub Copilot | yes | yes | yes | yes | yes | yes | yes |
| Cursor | yes | yes | yes | yes | yes, not headless | no | yes |
| OpenCode | yes | no | no | yes | yes | no | no |
| Kilo Code | yes | no | no | yes | yes | no | no |
| Antigravity CLI | yes | no | yes | yes | yes | no | no |
| Kiro | yes | no | yes | yes, matcher mapped | yes | no | no |
| Kimi Code CLI | no | no | no | no | no | no | no |

yes: the CLI writes the event to the host's hook file or bridge. no: it drops the event, and a build warns where it can.

Sources: [Claude Code](https://code.claude.com/docs/en/hooks), [Codex](https://learn.chatgpt.com/docs/hooks), [Copilot](https://docs.github.com/en/copilot/reference/hooks-configuration), [Cursor](https://cursor.com/docs/agent/hooks), [Antigravity](https://antigravity.google/docs/hooks), [Kiro](https://kiro.dev/docs/hooks/types/). The event map is in `cli/src/composition/tool-profiles/`.

## Antigravity limits

- `agy` has no prompt-submitted event; a silent `PreToolUse` script answers `allow`, because `{}` denies.
- A matcher is an anchored regular expression over `agy`'s tool names (`edit_file`, not `write_file`); the CLI reads it as a `|` list of names, so a regular-expression part selects nothing.
- No `PostToolUse` answer shape reached the model.
- A hook runs from `.agents/`; a user-level hooks file also running alongside the project one is unverified.

## Cursor limits

- A project `.cursor/hooks.json` fires; a plugin-scope `hooks.json` fired none of seven events.
- `postToolUse` takes `additional_context` only, so `decision: block` after a write is dropped.
- A headless `cursor-agent -p` delivers no `stop`.

## OpenCode and Kilo limits

- `SessionStart` runs once per server with a null `session_id`; a child session runs its own `Stop`; `SessionEnd` is unverified.
- A throw from a prompt hook stops the prompt, but the reason shows only as `UnknownError` or HTTP 500.
- Kilo `run` can exit before a `Stop` follow-up lands.

## Codex limits
- A project hooks file is skipped in an untrusted project.

## Kiro limits

- Only `SessionStart`, `PreToolUse`, `PostToolUse` and `Stop` are written; a matcher becomes Kiro's tool tags, one hook per tag.
- Text a `PostToolUse` command prints was not seen reaching the model.
- `Stop` with `{"decision":"block"}` starts another turn; the CLI ends the turn when a script crashes. `Stop` fires once per prompt.

## Kimi Code CLI limits

- Hooks live only in the user-level `~/.kimi-code/config.toml`; a build warns and ships none.
- A Claude agent tool with no Kimi name is dropped from `tools`, which narrows the grant.
- The install does not merge MCP servers; the flat build writes `.kimi-code/mcp.json`.
