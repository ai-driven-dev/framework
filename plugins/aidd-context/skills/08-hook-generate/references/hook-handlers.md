# Hook handlers

How a handler reads the event and signals back, per tool.

| Aspect | Rule |
| --- | --- |
| Handler | a script the tool runs at the moment |
| Input | the event as JSON on stdin |
| Signal | the exit code, and optionally JSON on stdout |
| Blocking | an exit denies or halts the action only where the moment and the tool allow it |

| Tool | Exit codes | Stdout |
| --- | --- | --- |
| Claude Code | `0` success, `2` blocks on a moment that honors it with stderr shown to the model, any other code a non-blocking error | `0` may carry a JSON object that steers the session; after a tool, the model reads context only from stdout, via `{ "hookSpecificOutput": { "hookEventName": "PostToolUse", "additionalContext": "..." } }` |
| Codex CLI | same as Claude Code | same key as Claude Code; any other key fails the hook |
| GitHub Copilot | same as Claude Code | after a tool, context only via a top-level `{ "additionalContext": "..." }` |
| Cursor | `0` success, `2` blocks like `permission: "deny"`, any other code fails open; `failClosed: true` on the entry makes a crash block | a gating moment returns `{ "permission": "allow" }`, with `deny` or `ask` as the other values |
| Antigravity CLI | signals by JSON decision, not by exit `2` | `PreToolUse` returns `decision` (`allow`, `deny`, `ask`) with an optional `reason`; `Stop` resumes with `decision: continue` and a `reason`; `PostToolUse` returns `{}`; `SessionStart` returns `{}` with optional `injectSteps` |

| Tool | Stdin |
| --- | --- |
| Antigravity CLI | JSON with `conversationId` and `workspacePaths`; tool events add `toolCall.{name,args}` |

| Intent | Effect | Moment it fits |
| --- | --- | --- |
| inform the model | the model reads a message and decides | after a tool runs, session start, turn stop |
| block before a tool runs | the tool call is denied | before a tool runs |
| require a fix after a write | the model must correct before going on | after a tool runs |
| keep the turn going at Stop | the turn continues until the check passes | turn stop |
| side effect only | format or log; the model is told nothing | any |

| Intent | Claude Code | Codex CLI | Cursor | GitHub Copilot |
| --- | --- | --- | --- | --- |
| inform the model | stdout `hookSpecificOutput.additionalContext` | same | stdout `{ "additional_context": "..." }` | stdout `{ "additionalContext": "..." }` |
| block before a tool runs | exit `2` | exit `2` | `{ "permission": "deny" }` or exit `2` | exit `2` |
| require a fix after a write | stdout `{ "decision": "block", "reason": "..." }` | same | unsupported; it informs instead | same as Claude Code |
| keep the turn going at Stop | stdout `{ "decision": "block", "reason": "..." }` | same | stdout `{ "followup_message": "..." }`, unverified headless | same as Claude Code |
| side effect only | exit `0`, no stdout | same | same | same |

| Case | Rule |
| --- | --- |
| One script for several tools | write the stdout key each host reads, chosen by the payload (Copilot's carries `tool_result`) |
| Which moments can block, and the full stdout schema | read the tool's docs listed in `hook-support` |
| A Stop hook that keeps the turn going | check the host's continuation flag first, so it asks once: `stop_hook_active` on Claude Code, Codex and Copilot, `loop_count` on Cursor |
| Codex simple turn-complete notice | its `notify` mechanism: user scope only, one turn-complete event, JSON on argv not stdin |
