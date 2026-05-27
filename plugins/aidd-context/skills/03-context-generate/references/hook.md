# Claude Code hooks

Hooks are deterministic handlers fired at specific points in Claude Code's lifecycle. They live in JSON files and support five handler types: `command`, `http`, `prompt`, `agent`, `mcp_tool`.

## File locations and scope

| Location                          | Scope                  | Shareable |
| --------------------------------- | ---------------------- | --------- |
| `~/.claude/settings.json`         | All projects (user)    | No        |
| `.claude/settings.json`           | Single project         | Yes (VCS) |
| `.claude/settings.local.json`     | Single project (local) | No        |
| `<plugin>/hooks/hooks.json`       | While plugin enabled   | Yes       |
| Skill / agent frontmatter `hooks` | Component lifetime     | Yes       |
| Managed policy settings           | Org-wide               | Yes       |

### Scope precedence and resolution

When the user asks for a "project hook" without naming a file, resolve in this order and stop at the first match:

1. **Plugin context detected** (`hook_request` mentions a specific plugin name OR the current working directory is inside a plugin) -> `<plugin>/hooks/hooks.json`.
2. **Component context detected** (the hook only fires inside a single skill / agent) -> `hooks:` block in that component's frontmatter.
3. **Project default** -> `.claude/settings.json`.
4. **Project local-only** (user explicitly says "don't share") -> `.claude/settings.local.json`.
5. **User-wide** -> `~/.claude/settings.json`.
6. **Org-wide** -> managed policy settings (requires admin scope).

Enterprise > project > user when the same hook is declared at multiple scopes.

## Top-level shape

In `hooks.json` (plugin) the file is the hooks object itself. In `settings.json` it sits under a top-level `hooks` key.

```json
{
  "<EventName>": [
    {
      "matcher": "<pattern>",
      "hooks": [
        { "type": "command", "command": "..." }
      ]
    }
  ]
}
```

`matcher` is optional (default = match all). Each matcher entry contains a `hooks` array of one or more handlers; handlers run in parallel and duplicates dedupe.

## Handler types

### `command`

Spawns a shell command or executable. Hook input arrives on stdin as JSON; output on stdout is parsed back as JSON.

| Field           | Required | Notes                                                                |
| --------------- | -------- | -------------------------------------------------------------------- |
| `type`          | yes      | `"command"`                                                          |
| `command`       | yes      | Shell command or absolute path.                                      |
| `args`          | no       | Array. When present, runs exec form (no shell tokenization).         |
| `shell`         | no       | `bash` (default) or `powershell`.                                    |
| `async`         | no       | Run in background, do not block the event.                           |
| `asyncRewake`   | no       | Run async, wake on exit code 2.                                      |
| `if`            | no       | Permission-rule filter, e.g. `Bash(git *)`, `Edit(*.ts)`.            |
| `timeout`       | no       | Seconds. Default 600.                                                |
| `statusMessage` | no       | Custom spinner label.                                                |
| `once`          | no       | Skills/agents only. Run once per session then remove.                |

### `http`

POSTs the event JSON to a URL.

| Field            | Required | Notes                                                              |
| ---------------- | -------- | ------------------------------------------------------------------ |
| `type`           | yes      | `"http"`                                                           |
| `url`            | yes      | URI.                                                               |
| `headers`        | no       | Header map. `$VAR` / `${VAR}` interpolation needs `allowedEnvVars`. |
| `allowedEnvVars` | no       | Array of env var names allowed in header interpolation.            |
| `if`             | no       | Permission-rule filter.                                            |
| `timeout`        | no       | Seconds. Default 600.                                              |
| `statusMessage`  | no       | Spinner label.                                                     |
| `once`           | no       | Skills/agents only.                                                |

Response: 2xx + JSON body = decision; 2xx + plain text = context; non-2xx = non-blocking error.

### `prompt`

Sends a one-shot prompt to a fast Claude model.

| Field           | Required | Notes                                                  |
| --------------- | -------- | ------------------------------------------------------ |
| `type`          | yes      | `"prompt"`                                             |
| `prompt`        | yes      | Prompt text. Use `$ARGUMENTS` for the hook JSON input. |
| `model`         | no       | Model ID. Defaults to a fast model.                    |
| `if`            | no       | Permission-rule filter.                                |
| `timeout`       | no       | Seconds. Default 30.                                   |
| `statusMessage` | no       | Spinner label.                                         |
| `once`          | no       | Skills/agents only.                                    |

### `agent`

Spawns a subagent.

| Field           | Required | Notes                          |
| --------------- | -------- | ------------------------------ |
| `type`          | yes      | `"agent"`                      |
| `prompt`        | yes      | Subagent prompt.               |
| `model`         | no       | Model ID.                      |
| `if`            | no       | Permission-rule filter.        |
| `timeout`       | no       | Seconds. Default 60.           |
| `statusMessage` | no       | Spinner label.                 |
| `once`          | no       | Skills/agents only.            |

### `mcp_tool`

Calls a tool on a connected MCP server.

| Field           | Required | Notes                                                                 |
| --------------- | -------- | --------------------------------------------------------------------- |
| `type`          | yes      | `"mcp_tool"`                                                          |
| `server`        | yes      | Configured MCP server name.                                           |
| `tool`          | yes      | Tool name on that server.                                             |
| `input`         | no       | Tool argument map. Supports `${path}` substitution from event payload. |
| `if`            | no       | Permission-rule filter.                                               |
| `timeout`       | no       | Seconds. Default 600.                                                 |
| `statusMessage` | no       | Spinner label.                                                        |
| `once`          | no       | Skills/agents only.                                                   |

## Event names

| Category       | Events                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle      | `SessionStart`, `Setup`, `SessionEnd`                                                                                                         |
| Prompt         | `UserPromptSubmit`, `UserPromptExpansion`                                                                                                     |
| Tool           | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`                                                                            |
| Permission     | `PermissionRequest`, `PermissionDenied`                                                                                                       |
| Agent / team   | `SubagentStart`, `SubagentStop`, `TeammateIdle`, `Stop`, `StopFailure`                                                                        |
| Task           | `TaskCreated`, `TaskCompleted`                                                                                                                |
| File / config  | `FileChanged`, `ConfigChange`, `CwdChanged`, `InstructionsLoaded`                                                                             |
| Compaction     | `PreCompact`, `PostCompact`                                                                                                                   |
| Notification   | `Notification`                                                                                                                                |
| Worktree       | `WorktreeCreate`, `WorktreeRemove`                                                                                                            |
| MCP            | `Elicitation`, `ElicitationResult`                                                                                                            |

## Matcher syntax (per `matcher` field)

| Pattern                            | Evaluation                              |
| ---------------------------------- | --------------------------------------- |
| `"*"` / `""` / omitted             | Match all                               |
| Letters / digits / `_` / `\|`     | Exact string(s); `\|` separates alternatives. |
| Anything else                      | JavaScript regex (`^Notebook`, `mcp__memory__.*`). |

Matchers are event-scoped (see official docs for what each event matches against - tool name, session source, agent type, etc.).

## Path placeholders in handlers

Available inside `command`, `args`, `args[]`, `input.*`, and `headers[*]` values:

Three env vars are available (write as `${VAR_NAME}` inside handler values):

- `CLAUDE_PROJECT_DIR` - project root.
- `CLAUDE_PLUGIN_DATA` - plugin persistent data directory.
- The plugin install directory variable (name: `CLAUDE_PLUGIN` + `_ROOT`) - resolved to the plugin's install path at process-spawn time. Use in hook `command` strings only - not in skill or action markdown paths, where relative `@`-prefixed paths apply.

Also exported as env vars to spawned processes.

## Exit codes (command handler)

| Code  | Behavior                                                                              |
| ----- | ------------------------------------------------------------------------------------- |
| `0`   | Success. Stdout parsed as JSON (or used as context on `SessionStart`/`UserPromptSubmit`). |
| `2`   | Blocking error. Stdout ignored; stderr surfaces to Claude.                            |
| other | Non-blocking error. First stderr line in transcript, full stderr in debug log.        |

Exit code 2 only blocks on these events: `PreToolUse`, `PermissionRequest`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `SubagentStop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `ConfigChange`, `PreCompact`. On others it logs only. `WorktreeCreate` blocks on ANY non-zero exit code.

## Stdout JSON schema (exit code 0)

```json
{
  "continue": true,
  "stopReason": "shown to user when continue=false",
  "suppressOutput": false,
  "systemMessage": "warning to user",
  "decision": "block",
  "reason": "explanation",
  "hookSpecificOutput": {
    "hookEventName": "<EventName>",
    "additionalContext": "string injected into Claude's context",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "...",
    "updatedInput": { "...": "..." }
  }
}
```

`additionalContext` works on `SessionStart`, `Setup`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PostToolUse`, `PostToolBatch`.

`permissionDecision` / `updatedInput` are `PreToolUse` only.

## Stdin JSON to every hook

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/dir",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "agent_id": "optional",
  "agent_type": "optional",
  "effort": { "level": "low|medium|high|xhigh|max" }
}
```

Plus event-specific fields (e.g. tool name + input for tool events).

## Conventions

- Prefer `command` handler with an absolute path using the plugin install directory variable (see "Path placeholders in handlers") pointing to `skills/<skill-name>/scripts/` for plugin hooks; the script is the artifact, the JSON entry is just the wiring.
- Use `if` (permission-rule filter) instead of regex matchers when possible - clearer intent.
- Never block on `PostToolUse` exit code 2 expecting it to undo the tool call (it does not).
- For long operations, set `async: true` so the event is not blocked, then signal completion via a follow-up event or by writing state files.
