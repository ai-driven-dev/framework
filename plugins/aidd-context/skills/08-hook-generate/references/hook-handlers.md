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

| Case | Rule |
| --- | --- |
| One script for several tools | write the stdout key each host reads, chosen by the payload (Copilot's carries `tool_result`) |
| Which moments can block, and the full stdout schema | read the tool's docs listed in `hook-support` |
| Codex simple turn-complete notice | its `notify` mechanism: user scope only, one turn-complete event, JSON on argv not stdin |
