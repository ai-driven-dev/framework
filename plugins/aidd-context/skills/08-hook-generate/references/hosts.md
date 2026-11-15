# Hosts

The host AI tools that carry a hook: how to detect each, the event for a moment, and what the script reads and answers there.

Detect by listing the project root with hidden entries, since a file search misses an empty marker.

| Host / ID | Detected when | Tool call on stdin | Script starts in | Docs |
| --- | --- | --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | `tool_name`, `tool_input` | the project root | [Hooks](https://code.claude.com/docs/en/hooks) |
| Codex CLI / `codex` | `.codex/` | `tool_name`, `tool_input` | the session's folder | [Hooks](https://developers.openai.com/codex/hooks) |
| Cursor / `cursor` | `.cursor/` | `tool_name`, `tool_input` | the project root | [Hooks](https://cursor.com/docs/hooks) |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/hooks/` | `toolName`, `toolArgs`, an object or a JSON string | the project root | [Hooks](https://docs.github.com/en/copilot/reference/hooks-configuration) |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` | `toolCall.name`, `toolCall.args` | `.agents/` | [Hooks](https://antigravity.google/docs/hooks) |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | `tool`, `args` | the project root | [Plugins](https://opencode.ai/docs/plugins) |
| Kilo Code / `kilo` | `.kilo/`, `kilo.jsonc` or `kilo.json` | `tool`, `args` | the project root | [Plugins](https://kilo.ai/docs) |

## Moment to event

A `-` means the host has no event for that moment.

| Moment | Claude, Codex | Cursor | Copilot | Antigravity | OpenCode, Kilo |
| --- | --- | --- | --- | --- | --- |
| session start | `SessionStart` | `sessionStart` | `sessionStart` | `SessionStart` | - |
| prompt submitted | `UserPromptSubmit` | `beforeSubmitPrompt` | `userPromptSubmitted` | `PreInvocation` | - |
| before a tool runs | `PreToolUse` | `preToolUse` | `preToolUse` | `PreToolUse` | `tool.execute.before` |
| after a tool runs | `PostToolUse` | `postToolUse` | `postToolUse` | `PostToolUse` | - |
| turn stop | `Stop` | `stop` | `agentStop` | `Stop` | - |
| session end | `SessionEnd` | `sessionEnd` | `sessionEnd` | - | - |

A matcher is a pattern on the tool's name, on tool events only, never on Copilot. The shell tool is `Bash` on Claude and Codex, `run_command` on Antigravity, `bash` on Kilo, and `bash` or `shell` on OpenCode, so `^(bash|shell)$` covers both of its versions.

## Intent per host

| Intent | Claude | Codex | Cursor | Copilot | Antigravity | OpenCode, Kilo |
| --- | --- | --- | --- | --- | --- | --- |
| inform the model | `additionalContext` | `additionalContext`, not at `Stop` | `additional_context` | `additionalContext` | - | - |
| block before a tool runs | exit 2 or `deny` | exit 2 or `deny` | exit 2 or `permission: deny` | exit 2 | `decision: deny` | exit 2, reason on stderr |
| ask before a tool runs | `ask` | - | - | `ask` | `decision: ask` | - |
| require a fix after a write | `decision: block` | `decision: block` | - | - | - | - |
| keep the turn going at stop | `decision: block` | `decision: block` | `followup_message` | - | `decision: continue` | - |

Claude and Codex read decisions under `hookSpecificOutput`. Antigravity reads JSON on stdout only, and blocks when the script fails.

## Teammates

| Host | What a committed hook asks of a teammate |
| --- | --- |
| every host | the script's runtime on `PATH` |
| Claude, Cursor | trust the workspace |
| Codex | review the hook in `/hooks`, again after each change; an unreviewed hook is skipped silently |
| Copilot | admit the workspace; it also runs `.claude/settings.json`, so a hook for Claude and Copilot runs twice there |
