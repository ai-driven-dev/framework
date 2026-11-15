# Hosts

Which host AI tools carry a hook, how to detect them, the event each uses for a moment, and what each intent becomes there.

Detect by listing the project root with hidden entries, since a file search misses an empty or folder-only marker.

| Host / ID | Detected when | Receives | Source |
| --- | --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | an entry in `.claude/settings.json` | [Hooks](https://code.claude.com/docs/en/hooks) |
| Codex CLI / `codex` | `.codex/` | an entry in `.codex/hooks.json` | [Hooks](https://developers.openai.com/codex/hooks) |
| Cursor / `cursor` | `.cursor/` | an entry in `.cursor/hooks.json` | [Hooks](https://cursor.com/docs/hooks) |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/hooks/` | its own file in `.github/hooks/` | [Hooks](https://docs.github.com/en/copilot/reference/hooks-configuration) |
| Antigravity / `antigravity` | `.agents/agents/`, `.agents/rules/` or `.agents/hooks.json` | a key in `.agents/hooks.json` | [Hooks](https://antigravity.google/docs/hooks) |
| OpenCode / `opencode` | `.opencode/`, `opencode.json` or `opencode.jsonc` | a gateway plugin in `.opencode/plugins/` | [Plugins](https://opencode.ai/docs/plugins) |
| Kilo Code / `kilo` | `.kilo/`, `kilo.jsonc` or `kilo.json` | a gateway plugin in `.kilo/plugin/` | [Plugins](https://kilo.ai/docs) |

Each host also receives a copy of the script in its own `hooks/` folder. The writer refuses an event the host does not list, and names the ones it does.

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

A matcher is a pattern on the tool's name, accepted on tool events only, and never on Copilot. OpenCode V1 and Kilo name the shell tool `bash`, OpenCode V2 names it `shell`, so `^(bash|shell)$` covers both.

## Intent per host

| Intent | Claude | Codex | Cursor | Copilot | Antigravity | OpenCode, Kilo |
| --- | --- | --- | --- | --- | --- | --- |
| inform the model | `additionalContext` | `additionalContext`, ignored at `Stop` | `additional_context` | `additionalContext` | - | - |
| block before a tool runs | exit 2 or `deny` | exit 2 or `deny` | exit 2 or `permission: deny` | exit 2 | `decision: deny` | exit 2, reason on stderr |
| ask before a tool runs | `ask` | - | `ask` accepted, never applied | `ask` | `decision: ask` | - |
| require a fix after a write | `decision: block` | `decision: block` | - | - | - | - |
| keep the turn going at stop | `decision: block` | `decision: block` | `followup_message` | - | `decision: continue` | - |
| side effect only | exit 0 | exit 0 | exit 0 | exit 0 | exit 0 | exit 0 |

The decision fields Claude and Codex read sit under `hookSpecificOutput`. Copilot blocks with exit 2 only on `preToolUse` and `permissionRequest`. Antigravity reads JSON on stdout only, and blocks when the script fails.

## Where it runs

| Host | Script starts in | Command names the script as |
| --- | --- | --- |
| Claude | the project root | `"$CLAUDE_PROJECT_DIR"/<path>` |
| Codex | the session's folder | `"$(git rev-parse --show-toplevel)/<path>"` |
| Cursor | the project root | `"$CURSOR_PROJECT_DIR"/<path>` |
| Copilot | the repository root, through `cwd: "."` | the path from the root |
| Antigravity | `.agents/` | the path from `.agents/` |
| OpenCode, Kilo | the project root, through the gateway | the path from the root |

## Teammates

| Host | What a committed hook asks of a teammate |
| --- | --- |
| every host | the script's runtime on `PATH` |
| Claude | trust the workspace |
| Codex | review the hook in `/hooks`; a changed hook is reviewed again |
| Cursor | trust the workspace |
| Copilot | admit the workspace; it also runs `.claude/settings.json`, so a hook written for Claude and Copilot runs twice there |
| OpenCode, Kilo | nothing beyond the runtime; the gateway loads with the project |

These facts were read from each host's docs and checked in a run of each host; they drift with host versions, so a trial rechecks them.
