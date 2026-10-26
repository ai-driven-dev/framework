---
status: done
---

# Codex asks for its task

## Need

Codex calls are measured, but nothing asks a Codex session for its task: a call on a branch nobody declared stays unattributed, and Codex is ingested only when a Claude Code session starts or a report runs. The plugin's hooks already ship to Codex (the CLI translates them, and Codex sets `CLAUDE_PLUGIN_ROOT` for plugin hooks), and each one returns early because its guard accepts Claude Code's payload only. The observations behind every rule below are in `evidence.md`.

## Decision

The same three hooks serve both tools. Only what tells the tool, its session and whether a person can see a block differs.

| Hook | Claude Code (unchanged) | Codex |
| --- | --- | --- |
| guard | payload `session_id` equals `CLAUDE_CODE_SESSION_ID`, transcript under a Claude `projects` directory | transcript is a Codex session file (`…/sessions/YYYY/MM/DD/rollout-….jsonl`), `session_id` set; Claude Code's guard still refuses it |
| `catch-up.cjs` (SessionStart, async) | ingest | ingest, the same command |
| `session-start.cjs` (SessionStart, sync) | records the process and carries a task across `/clear` and a branched session | does nothing: Codex gives a hook no process id. A Codex `/clear` or fork is asked again |
| `prompt-gate.cjs` (UserPromptSubmit) | asks, answers a typed declaration | the same, when a person can see the block |
| session of a declaration | `CLAUDE_CODE_SESSION_ID` | the payload's `session_id`, passed by the hook to `aidd telemetry task` |

### Whether a person can see a block

Codex shows a hook's block reason in the TUI only: `codex exec` prints none, its `--json` output nothing, the desktop app shows it (observed), and the IDE extension is undocumented. A hook receives nothing that names the surface. The session file's first line does: `session_meta.originator`.

A Codex prompt is held only when all of these hold. Anything else, a field missing, another value, an unreadable file, a first line longer than the bound read, is "nobody to answer": the prompt goes through. A change in Codex can only stop the asking, never block work.

| Condition | Why |
| --- | --- |
| the session file's first line is a `session_meta` with `originator` `codex-tui` and no object `source` | the TUI, the one surface seen to show a block. Its `source` is `cli` bare and `vscode` once plugins run it through the app server, so `originator` alone tells the surface. A sub-agent's own file has an object `source`, refused as a second guard |
| the payload has no `agent_id` | a sub-agent's spawn message reaches `UserPromptSubmit` with the root's `session_id`; nobody types it |
| `permission_mode` is exactly `default` (missing or any other value is nobody to answer) | a resumed thread keeps its first line, so a TUI thread resumed by `codex exec` still reads `codex-tui`; `exec` forces approval `never`, which is `bypassPermissions` |

- The first line is read up to a bound, never the file whole. Codex writes and flushes it before it hands a hook the path.

### The session a declaration binds

- `aidd telemetry task` binds the session named by `AIDD_TELEMETRY_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`, read by the composition root. The Codex hook sets the first for the command it runs; nothing else does.
- A Codex block cannot hide the typed declaration: the reason says it was recorded, and the prompt is not sent to the model.

## Properties

| # | Property | Tested by |
| --- | --- | --- |
| H1 | A Codex payload passes the Codex guard and fails the Claude Code one; a Claude Code payload the reverse; a Codex session started inside Claude Code (which inherits `CLAUDE_CODE_SESSION_ID`) is Codex | shared fixture, both sides |
| H2 | A Codex prompt on an undeclared working branch is held when, and only when, every condition above holds | hook tests over every originator seen (`codex-tui`, `codex_exec`, `codex_vscode`, `Codex Desktop`, `Claude Code`), an object `source`, a payload with `agent_id`, each `permission_mode`, a missing file, a first line past the bound |
| H5 | The catch-up ingest stays asynchronous on Codex, in both install routes (plugin tree and the merged `.codex/hooks.json`) | translation tests: `async` and `timeout` kept |
| H3 | A declaration typed in a Codex session binds that session, and the report attributes its calls, sub-agents' included | end to end, synthetic Codex session file |
| H4 | Every Claude Code behaviour is unchanged | the existing hook suite and `check-claude-tokens-end-to-end.cjs`, both modes |

## Limits

Written into the usage contract and the plugin README; none is code.

- Codex runs a plugin's hooks only once a person trusted each one (`/hooks` in the TUI). Until then nothing asks, and ingest runs only from Claude Code or a report. A plugin update that changes a hook's entry in `hooks.json` needs trusting again; a change to the script alone does not.
- Asked in the Codex TUI only, and not in full-access mode (approval `never`). `codex exec`, the IDE extension and the desktop app's own threads are never asked.
- A TUI thread resumed by `codex exec` with an auto-review approver (`--approve-for-me`, or `approvals_reviewer = "auto_review"`) is not `bypassPermissions`: its prompt would be held with no one to see why. Not observed.
- A Codex `/clear` or fork is a new session with no carried task: asked again on an undeclared branch.
- A TUI thread resumed in the desktop app or the IDE extension is held there unless approvals are off (inferred: a resume keeps the thread's first line). The desktop app shows a block's reason, observed on its own thread; the IDE extension was not observed.

## Out of scope

- Reading Codex's hook trust to report it in `aidd telemetry status`.
- The IDE extension, until observed.
