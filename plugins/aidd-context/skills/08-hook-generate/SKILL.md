---
name: 08-hook-generate
description: Generate a hook, a handler that runs at a lifecycle event, across the host AI tools. Use when the user wants to create, scaffold, or refactor a hook, or automate an action at a lifecycle point. Not for other artifacts like skills or rules.
argument-hint: event | action
---

# Hook Generate

Builds one hook for tools with a documented declarative contract. For plugin-only tools, returns sourced guidance without generating a hook.

## Actions

| #   | Action         | Role                                              | Input             |
| --- | -------------- | ------------------------------------------------- | ----------------- |
| 01  | `capture-hook` | Clarify the moment, action, matcher, scope, tools | user request      |
| 02  | `write-hook`   | Return plugin guidance; preflight and write declarative targets | the captured spec |
| 03  | `validate`     | Check guidance or written files and relaunch safety | action 02 result |

Run actions `01 → 02 → 03` and each action's `## Test` in order for guidance-only, declarative-only, and mixed requests. Action 02 writes only confirmed declarative targets; for guidance-only requests it writes nothing, and action 03 checks the guidance and unchanged project tree.
Before running an action, read its file in `actions/`, not only the table or assets.

## References

- `references/hook-authoring.md`: the contract (R1-R7), the lifecycle moments, and the handler, matcher, and exit-code model.
- `references/tool-paths.md`: per-tool support, moment-to-event names, file formats, scopes, and write targets.

## Assets

- `assets/hook-template.json`: the entry scaffold.
- `assets/hook-script-template.sh`: the backing-script scaffold.
