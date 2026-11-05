# hook-payloads

What each host really sends a hook, one file per host and event, named `<host>-<event>.json` with
the event spelled as the host spells it. Read by the CLI converter tests and the hook tests alike.

## Shape

`{ host, event, samples: [...] }`. A sample is `{ run, payload, hookAnswer }`:

- `payload` is the full stdin JSON of one call, values as the host sent them, `tool_input` and
  `tool_response` in the type the host used (an object on most hosts, a string on Copilot's
  `Edit`).
- `run` is `log` (the hook only logged) or `level2` (the hook answered `decision: "block"` once on
  the first file write and once at the first Stop, to learn whether the host delivers them).
- `hookAnswer` is what the logging hook printed for that call, `null` when it printed nothing.

## OpenCode and Kilo

They send no stdin payload: a plugin receives arguments. The files hold those raw arguments, named
after the plugin hook or event that carried them: `tool.execute.after` is `{ call, output }`,
`session.idle` and `session.created` are the bus events, `server-init` is the plugin's init input
(the moment the bridge runs SessionStart). `hookAnswer` does not apply there.

## Scrubbing

Home and project paths are `/Users/user` and `/Users/user/project`, every session id is the one
fake id `00000000-0000-4000-8000-000000000000`, the account email is `user@example.com`, and
timestamps and dated session-file names are fixed to the epoch. Nothing else is altered.

## Established

SessionStart, Stop, and PostToolUse for a file write and a shell command on Claude Code, Codex,
Copilot, OpenCode and Kilo; Cursor's `sessionStart` and `postToolUse`. Codex's `transcript_path`
carries a value. Copilot's file write arrives as `Edit` with a `*** Begin Patch` string.

## Not captured

Cursor's `stop`: it did not fire in a headless `cursor-agent -p` run, and no interactive run was
made.
