# 03 - Check

Find what drifted in the bank.

## Input

The bank and the scan's capabilities.

## Process

1. Review the whole bank per the [review protocol](../references/review-protocol.md), the output of `changes` first.
2. Make every finding an unanswered `D` line of the [fact sheet](../assets/fact-sheet.md), asking nothing, then read [write](02-write.md).
   - Do not propose removing `browsing.md` only because no browser is configured now; remove it only when the user confirms it is no longer needed.

## Output

D lines added to the sheet.

## Rules

- Change no memory file.
- Never offer to remove a file.
