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

| Id | Rule | Why |
| --- | --- | --- |
| H1 | One hook, one purpose, at the narrowest moment that fits. | A hook that fires too broadly slows or blocks every turn. |
| H2 | Give a tool event a matcher on the exact tool it guards. | An empty matcher runs the script on every tool. |
| H3 | Put the logic in the script, the config only names it. | The writer renders the config; a hand edit is lost. |
| H4 | Write the script in a runtime the project already uses. | A teammate needs that runtime on `PATH`. |
| H5 | Read the host's own payload on stdin, and answer in its own format. | No adapter sits between the host and the script. |
| H6 | Branch on the host ID, the script's first argument, when several hosts share the script. | Each host sends and reads different fields. |
| H7 | Keep a stop hook to one extra turn by reading the host's flag: `stop_hook_active` on Claude and Codex, `loop_count` on Cursor. | Without it, the turn never ends. |
| H8 | Exit 0 when the hook has nothing to say. | Any other exit is a block or an error on some host. |
| H9 | Write in English. | The tree is maintained in one language. |
