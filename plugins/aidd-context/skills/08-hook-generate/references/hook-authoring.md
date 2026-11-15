# Hook authoring

What a hook does, and how its script is written. A hook is a script a host runs at a lifecycle moment, wired by a config entry or a gateway plugin.

## Intent

The user picks what the hook does; `hosts.md` says what each intent becomes on each host.

| Intent | Effect | Moment it fits |
| --- | --- | --- |
| inform the model | the model reads a message and decides | session start, prompt submitted, after a tool runs |
| block before a tool runs | the tool call is denied with a reason | before a tool runs |
| ask before a tool runs | the user confirms the tool call | before a tool runs |
| require a fix after a write | the model must correct before going on | after a tool runs |
| keep the turn going at stop | the turn continues until the check passes | turn stop |
| side effect only | format, log; the model is told nothing | any |

## Rules

- H1: One hook, one purpose, at the narrowest moment that fits.
- H2: Give a tool event a matcher on the exact tool it guards, since an empty one runs on every tool.
- H3: Put the logic in the script; the config only names it.
- H4: Write the script in a runtime the project already uses.
- H5: Read the host's own payload on stdin and answer in its own format.
- H6: Branch on the host ID, the script's first argument, when several hosts share the script.
- H7: Keep a stop hook to one extra turn by reading `stop_hook_active` on Claude and Codex, `loop_count` on Cursor.
- H8: Exit 0 when the hook has nothing to say.
