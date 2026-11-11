# 03 - Validate

Confirm each written hook entry and script satisfy the contract, per tool.

## Input

The list of paths touched by write hook.

## Process

1. Confirm each target file parses in its format, with the entry in the moment's list and every prior entry intact.
2. Confirm the event name is that tool's name for the moment in [hook-moments.md](../references/hook-moments.md) and the matcher is well-formed per [hook-shapes.md](../references/hook-shapes.md).
3. Confirm a blocking hook sits on a moment that can block on that tool, per [hook-handlers.md](../references/hook-handlers.md).
4. Confirm each handler's script exists, is executable, and reads stdin and signals per `hook-handlers.md`.
5. Confirm every handler path is a form [hook-paths.md](../references/hook-paths.md) allows.
6. Fix each failure and repeat steps 1 to 5 until every check passes.
   - Unresolved failure: report the failing file and stop when a fix is outside the confirmed scope or cannot be completed.

## Output

A short pass or fail line per tool, plus the script.
