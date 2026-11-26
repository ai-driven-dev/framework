# 02 - Diff

Sort this run's gaps against the prior report into closed, still open and newly introduced.

## Input

This run's gaps, and the prior report next to the source.

## Process

1. Read each `[severity] probe` line of the prior report, or `**[severity]** probe` in an older one, as a gap of the category it sits under, with the blockquote right after it as its snippet.
2. Put each prior gap with no current gap of the same identity in closed, with its prior probe.
3. Put each current gap with a prior gap of the same identity in still open, and the rest in newly introduced, with their current probe.
4. Go to [render-report](03-render-report.md).

## Output

The closed, still open and newly introduced gaps, each with its category and severity.
