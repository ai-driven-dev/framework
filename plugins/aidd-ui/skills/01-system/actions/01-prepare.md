# 01 - Prepare

Settle what the run writes.

## Input

The request.

## Process

1. Find the [engine](../references/engine.md); none: stop and say it is missing.
2. Read `aidd_docs/ui/` and the UI code, whatever its platforms, and name the state:
   - no `system.md`, no UI code: blank;
   - no `system.md`, UI code: existing code;
   - `system.md`: design system.
3. Take the task folder named, else ask for it: History rows cite its path, the folder need not exist, nothing is written in it.
4. For a change:
   - vague: ask which token or element, and which value;
   - run `impact` on it and show the report, its `same-value` tokens for the user to include or leave;
   - wait; refused: stop.
5. Read [write](02-write.md).

## Output

The state, the task folder, and for a change its agreed impact.
