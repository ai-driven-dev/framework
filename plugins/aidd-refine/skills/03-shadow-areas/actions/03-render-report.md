# 03 - Render Report

Write the shadow report next to the source.

## Input

The gaps and warnings from detect, the closed, still open and newly introduced gaps when diff ran, and the source path.

## Process

1. Fill [report-template.md](../assets/report-template.md).
   - Warnings: list them under Warnings.
   - Diff ran: split each category into Closed, Still Open and Newly Introduced.
2. Write the report next to the source.
3. Run [validate-shadow-areas.cjs](../scripts/validate-shadow-areas.cjs) on the report, fix, repeat until it passes.
4. Answer with the report's path and its totals.

## Output

The report, written next to the source.

## Rules

- Keep a category heading, and a Closed, Still Open or Newly Introduced part, only when it holds a gap.
- Order the gaps of a part blocker, then major, then minor.
- Count only still open and newly introduced gaps in the totals and the status.
- Set `status: clean` only when no blocker and no major is counted, and remove the key otherwise.
