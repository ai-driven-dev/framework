# Hook authoring

The contract every generated hook must satisfy. A hook is a handler wired to a lifecycle moment, a config entry that runs a script when that moment occurs.

## Rules

- **R1.** Pick the narrowest lifecycle moment that fits the intent. A hook that fires too broadly is a bug.
- **R2.** One hook, one purpose. One entry carrying one handler intent.
- **R3.** The script is the artifact, the entry is just wiring. Put the logic in a script, never inline in the config.
- **R4.** Merge, never clobber. Append to the moment's existing list and preserve every sibling.
- **R5.** Match the blocking behavior to the moment and the tool. Only block where the tool lets that moment block.
- **R6.** Prefer a precise matcher over a broad one. Filter to the exact tool or path the hook cares about.
- **R7.** English only, in every file.

## Lifecycle moments

The agnostic moments a hook can target. Each tool names these differently and supports a different subset. `references/tool-paths.md` maps the commonly supported moments to each tool's event name; a moment absent from that table has no dedicated cross-tool event, so fold it into the nearest supported moment.

| Moment              | Fires when                                          |
| ------------------- | --------------------------------------------------- |
| session start       | a session begins                                    |
| prompt submitted    | the user submits a prompt                           |
| before a tool runs  | just before a tool call executes                    |
| after a tool runs   | just after a tool call returns                      |
| after a tool fails  | a tool call errors                                  |
| before compaction   | context is about to be compacted                    |
| after compaction    | context has just been compacted                     |
| subagent start      | a subagent begins                                   |
| subagent stop       | a subagent ends                                     |
| turn stop           | the agent finishes its turn                         |
| session end         | a session ends                                      |

Confirm the chosen moment exists for the target tool before wiring. If it does not, skip that tool with the reason.

## Intent

What the hook does when it fires. These are options to offer, the user chooses, and the hook stays the tool's native one:

| Intent | Effect | Typical mechanism |
| ------ | ------ | ----------------- |
| inform | the model reads a message and decides | context text on stdout, or the tool's context field |
| require a fix | the model must correct before going on | a blocking exit or decision after a tool runs, where the tool supports it |
| stop the turn ending | the turn continues until the check passes | a blocking decision at turn stop, where the tool supports it |

The exact mechanism per tool is in `references/tool-paths.md`.

## Handler contract

The shared handler is a script the tool runs at the moment:

- It receives the event as JSON on stdin.
- It does its work, then signals back through its exit code and, optionally, a JSON object on stdout.
- A zero exit is success. A blocking exit (where the moment and tool allow it) denies or halts the action.

The exact exit codes, stdout schema, and which moments can block are per tool, in `references/tool-paths.md`.

## Matcher

A matcher filters which occurrences of a moment fire the hook, most often by tool name. Omit it to match every occurrence. The matcher syntax and which moments accept one are per tool, in `references/tool-paths.md`.
