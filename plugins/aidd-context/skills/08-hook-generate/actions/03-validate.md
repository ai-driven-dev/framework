# 03 - Validate

Check the written hook against the contract, per tool.

## Input

The list of paths touched by write hook.

## Process

1. Confirm each target file still parses in its format, with the entry at the right key for its scope and every prior sibling intact.
2. Confirm the event name is the right one for that tool's moment and the matcher is well-formed, per [tool-paths.md](../references/tool-paths.md).
3. Confirm a blocking hook sits on a moment that can block on that tool.
4. Confirm a script-backed handler's script exists, is executable, and reads stdin and signals per the contract.
5. Confirm every handler path is an approved `${VAR}` or an absolute path under the workspace.
6. Fix each failure and repeat steps 1 to 5 until every check passes.

## Output

A short pass or fail line per tool, plus the script.
