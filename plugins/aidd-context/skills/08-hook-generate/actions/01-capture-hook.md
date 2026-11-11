# 01 - Capture hook

Produce the confirmed decisions for the hook: what fires, on what, where it goes and for which tools.

## Input

A free-form request to add a hook.

## Process

1. Read every file in `references/` and `assets/` before asking or writing anything.
2. Detect the installed tools.
3. Check each against [hook-support.md](../references/hook-support.md), and confirm which to target.
4. Pick the narrowest lifecycle moment that fits per [hook-authoring.md](../references/hook-authoring.md).
5. Check each target tool exposes the moment in [hook-moments.md](../references/hook-moments.md).
6. Decide what the backing script does at the moment, and whether it blocks, per [hook-handlers.md](../references/hook-handlers.md).
7. Set a matcher only when the moment must be filtered, per `hook-authoring.md`.
8. Choose the write mode: a host project or a plugin source.
   - Plugin source: name the plugin. The scope is the plugin scope of [hook-scopes.md](../references/hook-scopes.md), so ask no scope question.
9. For a host project, ask where to install, offering only the scopes the target tools support in `hook-scopes.md`.
   - Component scope: name the exact skill or agent file, and confirm the moment fits per `hook-scopes.md`.
10. Confirm every decision in writing with the user, naming the resolved scope and file, then read [write hook](02-write-hook.md).

## Output

In-context decisions, nothing written yet:

- the lifecycle moment the hook targets
- the backing script the hook runs
- the matcher, or none for every occurrence
- the scope to install into: the plugin scope for a plugin source
- the confirmed tools, and any skipped with a reason
- the write mode: a host project, or a plugin source

## Rules

- Stop when every tool is skipped, and report the reasons.
