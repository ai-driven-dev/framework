# 03 - Validate

Check each written agent file.

## Input

The list of files written (from 02).

## Output

A short pass or fail line per agent file.

## Process

1. **Exists.** Confirm each file is on disk at its expected path.
2. **Shape.** Confirm each file matches its target format ([tool-paths.md](../references/tool-paths.md)).
3. **Authoring.** Confirm the file meets [agent-authoring.md](../references/agent-authoring.md).

## Test

- Every agent file exists, identifies its role in the target format, and holds the behavior.
