---
name: 08-hook-generate
description: Generate a hook, a handler that runs at a lifecycle event, across the host AI tools. Use when the user wants to create, scaffold, or refactor a hook, or automate an action at a lifecycle point. Not for other artifacts like skills or rules.
argument-hint: event | action
---

# Hook Generate

Builds one hook for tools with a documented declarative contract. For Kilo, returns sourced plugin guidance without generating a hook.

## Actions

| #   | Action         | Role                                              | Input             |
| --- | -------------- | ------------------------------------------------- | ----------------- |
| 01  | `capture-hook` | Clarify the moment, action, matcher, scope, tools | user request      |
| 02  | `write-hook`   | Return Kilo guidance; preflight and write other targets | the captured spec |
| 03  | `validate`     | Check guidance or written files and relaunch safety | action 02 result |

Run the actions in order, `01 → 03`, and run each action's `## Test` before the next. Kilo-only stops after terminal guidance from action 01; a mixed request continues for the other targets without writing Kilo files.
Before running an action, read its file in `actions/`, not only the table or assets.

## References

- `references/hook-authoring.md`: the contract (R1-R7), the lifecycle moments, and the handler, matcher, and exit-code model.
- `references/tool-paths.md`: per-tool support, moment-to-event names, file formats, scopes, and write targets.

## Assets

- `assets/hook-template.json`: the entry scaffold.
- `assets/hook-script-template.sh`: the backing-script scaffold.
