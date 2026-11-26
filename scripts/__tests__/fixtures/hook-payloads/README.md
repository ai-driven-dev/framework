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
  reads it; `deny`, a refusal of the write to a locked spec at PreToolUse; `allow`, Antigravity's
  explicit allow of every other call; `continue`, Cursor's `followup_message` once at the first
  `stop`; `follow-up`, OpenCode's and Kilo's `chat.message` for a message a bridge sent itself at
  Stop, carrying the mark that tells it from the user's own; `person`, a message a plugin asked the
  host to show the person; `child`, a subagent's child session, which names its parent.
- `hookAnswer` is what the logging hook printed for that call, `null` when it printed nothing:
  JSON on most hosts. Kiro's SessionStart sample holds the bare text, since Kiro hands that
  hook's output to the model as printed; its Stop sample holds the JSON block decision.
  `hookExit` and `hookStderr` are present when the hook ended with a non-zero code, the way Kiro's
  PreToolUse refusal is delivered.

## OpenCode and Kilo

They send no stdin payload: a plugin receives arguments. The files hold those raw arguments, named
after the plugin hook or event that carried them: `tool.execute.before` is `{ call, output }`, the
call's arguments in `output.args`; `chat.message` is `{ input, output }`, the user's message in
`output.parts`; `tool.execute.after` is `{ call, output }`; `experimental.chat.system.transform` is
`{ input, output }` as the host passed them, `output.system` before the plugin adds to it;
`session.idle`, `session.created` and `message.updated` are the bus events: `session.created` is
the moment the bridge runs SessionStart for a new session, `message.updated` the first event of a
continued one. `hookAnswer` does not apply there.

`opencode-tui.toast.show.json` is the one file not sent to a hook: it holds what a plugin asked
OpenCode's client to show (`request`, the probe's own input) and the bus event the server published
for it (`event`), read from the server's event stream.

## OpenCode 2

`opencode-v2-*` files hold what OpenCode 2.4.1 handed a plugin's `setup` hooks, as the hook
received it: `prompt`, `context`, `experimental.idle`, `execute.before` and `execute.after`, plus
what its `session.get` and `session.synthetic` calls answered. A `context` sample keeps only
`sessionID`, `agent` and `system`, what a bridge reads of the request.

## Scrubbing

Home and project paths are `/Users/user` and `/Users/user/project`, every session id is the one
fake id `00000000-0000-4000-8000-000000000000`, a child session's `00000000-0000-4000-8000-000000000001`, the account email is `user@example.com`, and
timestamps, dates and dated session-file names are fixed to the epoch, and the temporary folder
is `/tmp`. Nothing else is altered.

## Established

SessionStart, Stop, and PostToolUse for a file write and a shell command on Claude Code, Codex,
Copilot, OpenCode and Kilo; Cursor's `sessionStart`, `postToolUse` and `stop`. PreToolUse on Claude Code, Codex, Copilot, Antigravity and Kiro: a write to a locked spec refused, a file created, a file edited, a shell call, in each host's own session; Cursor's is not captured (no quota left). Codex's
`transcript_path` carries a value. Copilot's file write arrives as `Edit` with a `*** Begin Patch`
string. Claude Code's `Edit` and its `PowerShell` tool, enabled by
`CLAUDE_CODE_USE_POWERSHELL_TOOL=1`. Cursor's edit, sent as a `Write` carrying the whole file, and
its `Delete`. OpenCode's and Kilo's `edit` and `apply_patch` arguments. Kiro's SessionStart, from
its CLI on the V3 engine: the session id carries a `sess_` prefix, and the model was seen reading
the hook's output between `<HOOK_INSTRUCTION>` tags, a JSON answer included as raw text. Kiro's
PostToolUse (an `fs_write` creating a file, a `str_replace` edit, an `execute_bash` call and a
`read_file`) and Stop, from `kiro-cli` 3.6.0 on the V3 engine, hooks declared in a project's
`.kiro/hooks/*.json` under the triggers `PostToolUse` and `Stop`, run as
`kiro-cli chat --v3 --no-interactive --trust-workspace --trust-tools=fs_write,fs_read,execute_bash
--model qwen3-coder-next "<prompt>"`. Their stdin carries no `stop_hook_active`. After a Stop hook
printed `{"decision": "block", "reason": ...}` the model answered the reason and Stop fired once
for that prompt, never again on the continuation turn. Output printed by a PostToolUse hook, in
every shape tried, was not read by the model.

## How the harder ones were reached

- Cursor's `stop` fires only in an interactive `cursor-agent`, run under `script` with its input
  held open; with its input closed, the turn ends `aborted`, then `error`.
- OpenCode and Kilo offer `apply_patch` only to a model whose id holds `gpt-`: a provider alias of
  that name was routed to another model by a local proxy. The arguments are the host's own tool
  schema; the model only filled them.

Antigravity's `PostToolUse` (a `write_file`, a `run_command`, then an `edit_file`) and `Stop` (`executionNum` 0, then 1 on the continued turn end), captured from real `agy` runs. Its payloads name their event in `hookEventName`. Its edit tool is `edit_file`, with `Path`, `Target` and `Replacement`. Its `SessionStart` was answered with an `injectSteps` system message carrying a passphrase (`run: answer`), and the model repeated the passphrase, so the injection reaches it. Its `PreInvocation` (`log`, then `relay`: a held message injected as `injectSteps`) was captured on `gemini-4-hydrogen-low`, and the model acted on it.

## Checking the fixtures against the hosts

`node scripts/refresh-hook-fixtures.cjs [--host claude,kiro] [--model host=id] [--write]` runs each
host headless in a throwaway project, with a hook that only records its stdin, and prints the run
time, then per host and moment whether the payload still has the committed shape (keys and types,
never values), under the host's version. Exit codes:

- 0: every moment matches.
- 1: a payload drifted or a hook never fired. It wins over 2.
- 2: a host could not be judged: not installed, it refused the run (a usage limit), or it delivered
  no hook at all.

It is local and opt-in: it runs the hosts under your own login and spends their quota, so no
workflow calls it. OpenCode and Kilo run under a throwaway home, with a plugin that records the
arguments they hand it. `--write` adds each payload whose shape no committed sample has, once,
scrubbed (paths, ids, email, ISO timestamps and dated session-file names; a timestamp that is a
bare number is fixed by hand), and removes nothing. Review the diff, then re-run the tests that
read the fixtures.

Limits:

- Codex and Copilot are not covered: a capture declaration for them was never run against a live
  host.
- Cursor's `stop` fires only in an interactive session, so it is reported as expected and not
  counted.
- Each run deletes the sessions it created: Claude Code's and Cursor's folders, Antigravity's
  conversation, brain and presence entries, Kiro's through `kiro-cli chat --delete-session`.
  Left behind: Antigravity's `cache/last_conversations.json` pointer and logs, and a socket-only
  folder Cursor creates under `~/.cursor/projects` with a shortened name.
- OpenCode and Kilo tool arguments are filled by the model, so an optional key (a `bash` call's
  `description`) may drift with the model and not with the host.
- A host's hook declaration is written here, in the form the host documents, and not installed with
  the built CLI: a hook installed through it records the plugin script's arguments, not the host's
  raw stdin the fixtures hold. The tool matchers come from these fixtures. The tool checks what a
  host sends, not what aidd declares.
