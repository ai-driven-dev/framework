# 03 - Validate

Check the affected files against the approved capture.

## Input

The approved capture and the write results.

## Output

A pass or fail with reasons, one row per rule.

## Process

1. **Check.** Check existence or deletion, approved fields and host schemas against [authoring](../references/rule-authoring.md) and [publication](../references/rule-publication.md).
2. **Share.** For affected shared publications, check signed uniqueness and last-rule cleanup, then verify survivors, user guidance and memory bytes.
3. **Repeat.** For hosts, republish through the same absolute writer path (`--publish` after a deletion) and require identical bytes.
4. **Report.** Deliver the rows, even when all pass.

## Rules

- **Claim consumption** only with matching and nonmatching file evidence from fresh host sessions.
