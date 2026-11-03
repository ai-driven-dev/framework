# 01 - Prepare

Settle what the run writes.

## Input

The request.

## Process

1. Find the [engine](../references/engine.md); none: stop and say it is missing.
2. Read `aidd_docs/ui/` and the web code, and name the state:
   - no `system.md`, no web UI: blank;
   - no `system.md`, web UI: existing code;
   - `system.md`: design system;
   - native UI only: stop, saying it covers web apps; web and native: the web part only.
3. Take the task folder named, else ask for it.
4. For a change:
   - vague: ask which token or element, and which value;
   - run `impact` on it and show the report;
   - name the tokens holding the same value in a theme without aliasing it, for the user to include or leave;
   - wait; refused: stop.
5. Read [write](02-write.md).

## Output

The state, the task folder, and for a change its agreed impact.
