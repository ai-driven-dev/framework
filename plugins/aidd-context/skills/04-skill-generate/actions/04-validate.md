# 04 - Validate

Review the written skill against the contract and fix what breaks.

## Input

The skill written by write.

## Process

1. Review each file against [review-protocol.md](../references/review-protocol.md).
2. Apply the confirmed fixes on disk.
   - If a file changed, go back to step 1 for that file.
3. Report the findings, even when clean.

## Output

A report, one row per written file: what was checked and any fix applied.

## Rules

- Name the broken rule and a `file:line` for every finding.
