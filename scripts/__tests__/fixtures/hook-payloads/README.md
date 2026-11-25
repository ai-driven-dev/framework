# hook-payloads

What each host really sends a hook, one file per host and event, named `<host>-<event>.json` with
the event spelled as the host spells it. Read by the CLI converter tests and the hook tests alike.

## Shape

`{ host, event, samples: [...] }`. A sample is `{ run, payload, hookAnswer }`:

- `payload` is the full stdin JSON of one call, values as the host sent them, `tool_input` and
  `tool_response` in the type the host used (an object on most hosts, a string on Copilot's
  `Edit`).
- `run` says what the hook answered: `log`, nothing; `level2`, `decision: "block"` once on the
  first file write and once at the first Stop, to learn whether the host delivers them; `answer`,
  a session token at SessionStart in the key the host's adapter prints, to learn whether the model
  reads it; `continue`, Cursor's `followup_message` once at the first `stop`; `follow-up`,
  OpenCode's and Kilo's `chat.message` for a message a bridge sent itself at Stop, carrying the mark
  that tells it from the user's own.
- `hookAnswer` is what the logging hook printed for that call, `null` when it printed nothing:
  JSON on most hosts, the bare text on Kiro, which hands a hook's output to the model as printed.

## OpenCode and Kilo

They send no stdin payload: a plugin receives arguments. The files hold those raw arguments, named
after the plugin hook or event that carried them: `tool.execute.before` is `{ call, output }`, the
call's arguments in `output.args`; `chat.message` is `{ input, output }`, the user's message in
`output.parts`; `tool.execute.after` is `{ call, output }`; `experimental.chat.system.transform` is
`{ input, output }` as the host passed them, `output.system` before the plugin adds to it;
`session.idle`, `session.created` and `message.updated` are the bus events: `session.created` is
the moment the bridge runs SessionStart for a new session, `message.updated` the first event of a
continued one. `hookAnswer` does not apply there.

`opencode-tui.toast.show.json` is the one file not sent to a hook: it holds what a plugin asked OpenCode's client to show (`request`) and the bus event the server published for it (`event`), read from the server's event stream.

## Scrubbing

Home and project paths are `/Users/user` and `/Users/user/project`, every session id is the one
fake id `00000000-0000-4000-8000-000000000000`, the account email is `user@example.com`, and
timestamps and dated session-file names are fixed to the epoch. Nothing else is altered: a date
inside a host's own prompt text or model catalogue (`experimental.chat.system.transform`) is kept
verbatim.

## Established

SessionStart, Stop, and PostToolUse for a file write and a shell command on Claude Code, Codex,
Copilot, OpenCode and Kilo; Cursor's `sessionStart`, `postToolUse` and `stop`. Codex's
`transcript_path` carries a value. Copilot's file write arrives as `Edit` with a `*** Begin Patch`
string. Claude Code's `Edit` and its `PowerShell` tool, enabled by
`CLAUDE_CODE_USE_POWERSHELL_TOOL=1`. Cursor's edit, sent as a `Write` carrying the whole file, and
its `Delete`. OpenCode's and Kilo's `edit` and `apply_patch` arguments. Kiro's SessionStart, from
its CLI on the V3 engine: the session id carries a `sess_` prefix, and the model was seen reading
the hook's output between `<HOOK_INSTRUCTION>` tags, a JSON answer included as raw text.

## How the harder ones were reached

- Cursor's `stop` fires only in an interactive `cursor-agent`, run under `script` with its input
  held open; with its input closed, the turn ends `aborted`, then `error`.
- OpenCode and Kilo offer `apply_patch` only to a model whose id holds `gpt-`: a provider alias of
  that name was routed to another model by a local proxy. The arguments are the host's own tool
  schema; the model only filled them.

Antigravity's `PostToolUse` (a `write_file` then a `run_command`) and `Stop` (`executionNum` 0, then 1 on the continued turn end), captured from a real `agy` run. Its payloads name their event in `hookEventName`.
