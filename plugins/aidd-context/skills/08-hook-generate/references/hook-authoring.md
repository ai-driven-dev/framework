# Hook authoring

What a hook can do, and how its handler is written.

## Moments

| Moment | When the host runs it |
| --- | --- |
| `session-start` | a session opens |
| `prompt` | the user sends a prompt |
| `before-tool` | a tool is about to run |
| `after-tool` | a tool has run |
| `stop` | the agent ends its turn |
| `session-end` | a session closes |

## Effects

| Effect | What happens | Moment it fits |
| --- | --- | --- |
| `inform` | the model reads a message and decides | `session-start`, `prompt`, `after-tool` |
| `block` | the action is refused, with a reason | `before-tool`, `after-tool` |
| `ask` | the user confirms the tool call | `before-tool` |
| `continue` | the turn goes on until the check passes | `stop` |
| none | a side effect only, the model is told nothing | any |

## Rules

- H1: One hook, one purpose, at the narrowest moment that fits.
- H2: Give a tool event a matcher on the exact tool it guards where the host takes one, and filter in the handler where it does not.
- H3: Read the host's own payload and answer in its own format, as its description states.
- H4: Write a command host's handler in a runtime the project already uses, and a plugin host's handler as the plugin module its description names.
- H5: Answer nothing and exit 0 when the hook has nothing to say.
- H6: Keep a `continue` hook to one extra turn, through the loop field its description names.
