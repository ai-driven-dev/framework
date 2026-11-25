# Hosts

The hosts that carry a hook: how to detect each, the event for a moment, and what the script reads and answers there.

Detect by listing the project root with hidden entries, since a file search misses an empty marker. Test each listed path itself, never its parent: `.agents/skills/` alone signals no host.

| Host / ID | Detected when | Tool call on stdin |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | `tool_name`, `tool_input` |
| Codex CLI / `codex` | `.codex/` | `tool_name`, `tool_input` |
| Cursor / `cursor` | `.cursor/` | `tool_name`, `tool_input` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/hooks/` | `toolName`, `toolArgs`, an object or a JSON string |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` | `toolCall.name`, `toolCall.args` |
| Kiro / `kiro` | `.kiro/` | none: `SessionStart` is its only event |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | `tool`, `args` |
| Kilo Code / `kilo` | `.kilo/`, `kilo.jsonc` or `kilo.json` | `tool`, `args` |

The script starts in the project root, except on Codex, in the session's folder, and on Antigravity, in `.agents/`.

## Moment to event

A `-` means the host has no event for that moment.

| Moment | Claude, Codex | Cursor | Copilot | Antigravity | OpenCode, Kilo |
| --- | --- | --- | --- | --- | --- |
| session start | `SessionStart` | `sessionStart` | `sessionStart` | `SessionStart` | `server-init` on OpenCode, `session.created` on Kilo |
| prompt submitted | `UserPromptSubmit` | `beforeSubmitPrompt` | `userPromptSubmitted` | - | - |
| before a tool runs | `PreToolUse` | `preToolUse` | `preToolUse` | `PreToolUse` | `tool.execute.before` |
| after a tool runs | `PostToolUse` | `postToolUse` | `postToolUse` | `PostToolUse` | `tool.execute.after` |
| turn stop | `Stop` | `stop` | `agentStop` | `Stop` | `session.idle` |
| session end | `SessionEnd` | `sessionEnd` | `sessionEnd` | - | - |

A matcher is a pattern on the tool's name, on tool events only, never on Copilot. The shell tool is `Bash` on Claude and Codex, `run_command` on Antigravity, `bash` on Kilo, and `bash` or `shell` on OpenCode, so `^(bash|shell)$` covers both of its versions.

## Intent per host

| Intent | Claude | Codex | Cursor | Copilot | Antigravity | OpenCode, Kilo |
| --- | --- | --- | --- | --- | --- | --- |
| inform the model | `additionalContext` | `additionalContext`, not at `Stop` | `additional_context` | `additionalContext` | `injectSteps` with a `systemMessage`, at `SessionStart` | - |
| block before a tool runs | exit 2 or `deny` | exit 2 or `deny` | exit 2 or `permission: deny` | exit 2 | `decision: deny`, with its `reason` | exit 2, reason on stderr |
| ask before a tool runs | `ask` | - | - | `ask` | `decision: ask` | - |
| require a fix after a write | `decision: block` | `decision: block` | - | - | - | - |
| keep the turn going at stop | `decision: block` | `decision: block` | `followup_message` | - | `decision: continue` | - |

Claude and Codex read decisions under `hookSpecificOutput`. Antigravity reads JSON on stdout only, and blocks when the script fails, as observed on 1.5.17.

## Teammates

| Host | What a committed hook asks of a teammate |
| --- | --- |
| every host | the script's runtime on `PATH` |
| Claude, Cursor | trust the workspace |
| Codex | review the hook in `/hooks`, again after each change; an unreviewed hook is skipped silently |
| Copilot | admit the workspace; it also runs `.claude/settings.json`, so a hook for Claude and Copilot runs twice there |
