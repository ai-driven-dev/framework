# 01 - Scan

Read the project.

## Input

The project root.

## Process

1. On a refresh or a check request, run [`changes`](../references/engine.md).
2. Read the project in the order of [reading sources](../references/reading-sources.md).
3. Find its [capabilities](../references/capabilities.md) and its [outside tools](../references/ecosystem-signals.md).
4. On a check request, read [check](03-check.md).
5. Fill the [fact sheet](../assets/fact-sheet.md) for each file the capabilities select.
6. On a refresh, read [check](03-check.md); otherwise read [write](02-write.md).

## Output

The fact sheet.

## Rules

- Write only the sheet.
- Only what the code cannot say becomes a question.
