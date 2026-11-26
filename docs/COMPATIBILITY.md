# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks | Rules | Commands |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ✅ | Some events | ✅ | ✅ |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ✅ | Some events | ✅ | ✅ |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Antigravity CLI | `.agents/` | Plugin directory `.agents/plugins/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kiro | `.kiro/` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Kimi Code CLI | `.kimi-code/` | ✅ | ✅ | ✅ | ✅ | ✅ | Marketplace only | ✅ | ❌ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Some events | Through a generated bridge; events in [Hook events](#hook-events) |

## Hook events

What the CLI delivers for a plugin's hooks per host. The event map is in `cli/src/composition/tool-profiles/`, the refusal in each adapter under `cli/assets/hooks-runtime/`.

| Host | SessionStart | UserPromptSubmit | PreToolUse | PostToolUse | Stop | SessionEnd | SubagentStop | Refuse a write | Person message |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | yes | yes | yes | yes | yes | yes | yes | yes | yes, `systemMessage` ([hooks](https://code.claude.com/docs/en/hooks)) |
| Codex | yes | yes | yes | yes | yes | yes | yes | yes | yes, `systemMessage` as a warning ([hooks](https://developers.openai.com/codex/hooks)) |
| GitHub Copilot | yes | yes | yes | yes | yes | yes | yes | yes | yes, a `progress` line, text mode only and hidden under `--silent` ([hooks](https://docs.github.com/en/copilot/reference/hooks-configuration)) |
| Cursor | yes | yes | yes | yes | yes | no | yes | no | no: `user_message` only on a denial ([hooks](https://cursor.com/docs/hooks)) |
| OpenCode | yes | yes | yes | yes | yes | no | no | yes | yes, a TUI toast from the server plugin, not the V2 plugin or `opencode run` (probed) |
| Kilo Code | yes | yes | yes | yes | yes | no | no | yes | no: its TUI subscribes to the toast event, not observed (source) |
| Antigravity CLI | yes | no | yes | yes | yes | no | no | yes | no: `injectSteps` has an `errorMessage`, not used (binary strings) |
| Kiro | yes | yes | yes | yes | yes | no | yes | yes | no: stderr is a user warning on `AgentSpawn` only ([hooks](https://kiro.dev/docs/hooks/types/)) |
| Kimi Code CLI | yes | yes | no | no | no | no | no | no | no: the adapter prints no person message; a hook failure is the only warning ([hooks](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html)) |

yes: the CLI writes the event to the host's hook file or bridge. no: it drops the event, and a build warns where it can.

Sources: [Claude Code](https://code.claude.com/docs/en/hooks), [Codex](https://developers.openai.com/codex/hooks), [Copilot](https://docs.github.com/en/copilot/reference/hooks-configuration), [Cursor](https://cursor.com/docs/hooks), [Antigravity](https://antigravity.google/docs/hooks), [Kiro](https://kiro.dev/docs/hooks/), [OpenCode](https://opencode.ai/docs/plugins/), [Kilo](https://kilo.ai/docs/automate/extending/plugins), [Kimi](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html).

## Limits

### Antigravity CLI

| Limit | What it means for you |
| --- | --- |
| A hook matcher takes only the tools Write, Edit and Bash, renamed to `agy`'s own | Any other tool name is dropped from the matcher |
| A level 1 `PostToolUse` answer is not relayed to the model | Use level 2 to feed the model after a tool |
| A level 2 `PostToolUse` answer reaches the model at its next call, probed on `gemini-4-hydrogen-low` and `-medium` only | It costs one extra model call; other models are unverified |
| A silent `PreToolUse` script answers `allow` | Print a refusal to block; silence never does |
| A subagent's `tools` list keeps only tools with a name on the host | A Claude tool with no host name is dropped from its agent |

### Kimi Code CLI

| Limit | What it means for you |
| --- | --- |
| Only `SessionStart` and `UserPromptSubmit` are delivered | `PreToolUse`, `PostToolUse` and `Stop` hooks do not run |
| Whether `SessionStart` output reaches the model is unverified | The CLI prints none, so a `SessionStart` script's context may not arrive |
| `UserPromptSubmit` carries `prompt` as a list of text parts | A script reading it as a string breaks |
| A subagent's `tools` list keeps only tools with a name on the host | A Claude tool with no host name is dropped from its agent |

### Cursor

| Limit | What it means for you |
| --- | --- |
| Only a project `.cursor/hooks.json` fires | A plugin-scope hooks file does nothing |
| `postToolUse` takes `additional_context` only, so `decision: block` is dropped ([hooks](https://cursor.com/docs/hooks)) | A `PostToolUse` block does not stop Cursor |
| A headless `cursor-agent -p` run delivers no `stop` | A `Stop` hook such as a memory sync does not run headless |

### OpenCode and Kilo Code

| Limit | What it means for you |
| --- | --- |
| A subagent's child session runs neither `SessionStart` nor `Stop` | Hooks fire once per task, not per subagent |
| One `Stop` hook per plugin can continue a turn | After one blocks, the next stay silent |
| A `Stop` script runs inside the host's event hook | The whole host process waits for it, up to 5 s on every idle |
| A `SessionStart` script that exits 2 has its stderr added to the model's system prompt | Claude Code shows it to the person only; do not exit 2 for a message |
| On OpenCode 2, a refusal reaches only write and edit, and a message for the person is not shown | A hook that refuses a shell command is not stopped there |
| On OpenCode 2, a required finding is appended to the tool's result but never queued | A required `PostToolUse` finding is only informing there |
| A `UserPromptSubmit` throw stops the prompt but its reason reaches neither the person nor the model | A `UserPromptSubmit` script cannot refuse with a reason |
| A child session's prompt, the one its parent wrote, reaches `UserPromptSubmit` too | A `UserPromptSubmit` hook also runs for a subagent's task |
| A call made through Code Mode was not observed reaching a hook | Do not rely on a hook for those calls |
| On Kilo, a script's message for the person is not shown | Kilo has no person channel |
| In `kilo run`, a follow-up sent from `dispose` fails: the run drains and exits before it | A `Stop` follow-up sent at exit does not continue a headless Kilo run |

### Codex

| Limit | What it means for you |
| --- | --- |
| A hook is skipped silently until a person trusts it | Approve it once in an interactive session, or pass `--dangerously-bypass-hook-trust` to `codex exec` |
| A plugin installed from a marketplace registers no agent | Agents load from `~/.codex/agents` (`aidd setup --global`) or the project's `.codex/agents` (flat build) |

### Kiro

| Limit | What it means for you |
| --- | --- |
| A tool matcher becomes Kiro's tool tags, one hook per tag | Only `PostToolUse` takes a matcher; `Write`, `Edit` and `Delete` map to `write`, the shell tools to `shell` |
| Text a `PostToolUse` hook prints was not seen reaching the model | Do not use `PostToolUse` to feed the model on Kiro |
