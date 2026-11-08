# 03 - Check

Find what drifted in the bank.

## Input

The bank and the scan's capabilities.

## Process

1. Review the content per the [review protocol](../references/review-protocol.md), from the output of `changes`.
2. Check the format.
3. Judge the structure.
4. On a refresh, ask nothing: make every finding an unanswered `D` line of the [fact sheet](../assets/fact-sheet.md), then read [write](02-write.md).
5. On a check request, reply with the [report message](../assets/report-message.md).

## Output

D lines added to the sheet; on a check request, the printed report.

## Rules

- Change no memory file.
- Never offer to remove a file.
