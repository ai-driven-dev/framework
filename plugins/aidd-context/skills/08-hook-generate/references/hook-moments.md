# Hook moments

Which lifecycle moments exist, and each tool's event name for them. A `-` means no mapped event. Confirm it in the docs `hook-support` lists before treating it as absent.

| Moment | Fires when | Claude Code | Codex CLI | Cursor | GitHub Copilot | Antigravity CLI |
| --- | --- | --- | --- | --- | --- | --- |
| session start | a session begins | `SessionStart` | `SessionStart` | `sessionStart` | `SessionStart` | `SessionStart` |
| prompt submitted | the user submits a prompt | `UserPromptSubmit` | `UserPromptSubmit` | `beforeSubmitPrompt` | `UserPromptSubmit` | - |
| before a tool runs | just before a tool call executes | `PreToolUse` | `PreToolUse` | `preToolUse` | `PreToolUse` | `PreToolUse` |
| after a tool runs | just after a tool call returns | `PostToolUse` | `PostToolUse` | `postToolUse` | `PostToolUse` | `PostToolUse` |
| after a tool fails | a tool call errors | - | - | - | - | - |
| before compaction | context is about to be compacted | `PreCompact` | `PreCompact` | `preCompact` | `PreCompact` | - |
| after compaction | context has just been compacted | - | - | - | - | - |
| subagent start | a subagent begins | - | - | - | - | - |
| subagent stop | a subagent ends | `SubagentStop` | `SubagentStop` | `subagentStop` | `SubagentStop` | - |
| turn stop | the agent finishes its turn | `Stop` | `Stop` | `stop` | `Stop` | `Stop` |
| session end | a session ends | `SessionEnd` | `SessionEnd` | `sessionEnd` | `SessionEnd` | - |

| Tool | Naming note |
| --- | --- |
| GitHub Copilot | also accepts the camelCase names, such as `sessionStart` and `preToolUse` |
