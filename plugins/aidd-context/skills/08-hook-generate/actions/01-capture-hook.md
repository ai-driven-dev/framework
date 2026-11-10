# 01 - Capture hook

Clarify what fires, on what, where it goes, and for which tools before touching a file.

## Input

A free-form request to add a hook.

## Process

1. Run the asset-access precheck from [tool-paths.md](../references/tool-paths.md).
2. Detect the installed tools per `tool-paths.md`, and confirm which to target.
   - Skip a tool that does not support hooks, with its reason.
3. Pick the narrowest lifecycle moment that fits, per [hook-authoring.md](../references/hook-authoring.md).
   - Confirm each target tool exposes that moment in `tool-paths.md`, and skip a tool that lacks it with its reason.
4. Decide what runs at the moment, and whether it needs a backing script, per `hook-authoring.md`.
5. Set a matcher only when the moment must be filtered, and prefer a precise filter.
6. Ask the user where to install: a single agent or skill component, the shared project, the project local-only, or the user's global config.
   - Offer only the scopes the target tools support in `tool-paths.md`.
   - For a component scope, name the exact skill or agent file, and confirm the moment fits a component-scoped hook.
   - State the resolved file and wait for the user's confirmation.
7. Choose the write mode, a host project or a plugin source, and name the plugin for a plugin source.
8. Confirm every decision in writing with the user, naming the resolved scope and file, then read [write hook](02-write-hook.md).

## Output

In-context decisions, nothing written yet:

- the lifecycle moment the hook targets
- the action it runs, and whether it needs a backing script
- the matcher, or none for every occurrence
- the scope to install into
- the confirmed tools, and any skipped with a reason
- the write mode: a host project, or a plugin source
