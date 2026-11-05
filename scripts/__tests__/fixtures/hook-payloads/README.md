# hook-payloads

What each host really sends a hook, one file per host and event, named `<host>-<hook_event_name>.json`
with the event spelled as the host sends it. Read by the CLI converter tests and the hook tests alike.

## Source and limits

The files come from a hook that logged, per call, only: the event name, the tool name, the names of
every key of the payload, and `tool_input` as a string. Nothing else of a payload was recorded.

- `payloadKeys` is the real key list of that call. The values of every key it lists beyond
  `recorded` (session id, transcript path, tool response, and so on) were not captured and are not
  invented here.
- `recorded` holds the three fields whose values were captured. `tool_input` is the logged text: a
  host that sends an object and a host that sends a JSON string log the same, so the text cannot say
  which. Paths are scrubbed to `/Users/user/project`.
- `toolInputTruncatedAt` marks a `tool_input` the log cut at that many characters.
- `hookAnswer` and `hookStatus` are what the hook printed and exited with at that call.

## Established

PostToolUse, with a file write or edit and a shell command, on Claude Code, Codex, Cursor, Copilot,
OpenCode and Kilo.

## Not captured yet

SessionStart and Stop on all six hosts, and every payload value beyond the three above.
