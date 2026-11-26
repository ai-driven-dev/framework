# 02 - Report

Write the gaps as a shadow report next to the source.

## Input

The gaps from scan, the source path, and the existing report when there is one.

## Process

1. Name the report after the source, its last extension dropped and `-shadow-report.md` appended, in the source's folder: `feature.draft.md` gives `feature.draft-shadow-report.md`, `Makefile` gives `Makefile-shadow-report.md`.
2. Keep under Closed each open gap of the existing report that no current gap matches by category and quote, else by question.
3. Fill [report-template.md](../assets/report-template.md).
4. Write the report.
5. Run [validate-shadow-areas.cjs](../scripts/validate-shadow-areas.cjs) on the report without reading it, fix what it reports, repeat until it passes.
6. Answer with the report's path and its contradictions.

## Output

The report, next to the source.

## Rules

- Write the categories in the order of [categories.md](../references/categories.md).
- Count only the open gaps, and set `status: clean` when none is open, else `status: open`.
