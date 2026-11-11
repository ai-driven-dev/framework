# 03 - Validate

Confirm each written hook entry and script satisfy the contract, per tool.

## Input

The list of paths touched by write hook, and from 01 the moment, the matcher and whether the script blocks.

## Process

1. Confirm each target file parses in its format, with the entry in the moment's list and every prior entry intact.
2. Confirm the event name is that tool's name for the moment in [hook-moments.md](../references/hook-moments.md) and the matcher is well-formed per [hook-shapes.md](../references/hook-shapes.md).
3. Confirm a blocking hook sits on a moment that can block on that tool, in the docs listed in [hook-support.md](../references/hook-support.md).
4. Confirm each handler's script exists, is executable, and reads stdin and signals per `hook-handlers.md`.
5. Confirm every handler path is a form [hook-paths.md](../references/hook-paths.md) allows.
6. Fix each failure and repeat steps 1 to 5 until every check passes.
   - Unresolved failure: report the failing file and stop when a fix is outside the confirmed scope or cannot be completed.

## Output

A short pass or fail line per tool, plus the script.

## Process

1. **Parse.** Confirm each target file still parses in its format and the entry sits at the right key for its scope.
2. **Moment.** Confirm the event name is the right one for that tool's moment, and the matcher is well-formed ([tool-paths.md](../references/tool-paths.md)).
3. **Blocking.** If the hook blocks, confirm the moment can block on that tool ([tool-paths.md](../references/tool-paths.md)).
4. **Script.** For a script-backed handler, confirm the script exists, is executable, and reads stdin and signals per the contract.
5. **Name.** Confirm each new Claude Code or Codex handler has a nonempty `statusMessage` describing its action.

## Test

- Each target file parses with the entry under the correct key.
- Each event name matches the tool's moment, and any blocking hook sits on a moment that can block.
- Each new Claude Code or Codex handler has a nonempty, action-specific `statusMessage`.
