# 02 - Report

Write the gaps as a shadow report next to the source.

## Input

The gaps, the source path, and the previous report if any.

## Process

1. Name the report `<source>-shadow-report.md` next to the source, its last extension dropped: `spec.md` gives `spec-shadow-report.md`.
2. Move under Closed each gap of the previous report that no new gap matches.
3. Fill [report-template.md](../assets/report-template.md) and write the report.
4. Run [validate-shadow-areas.cjs](../scripts/validate-shadow-areas.cjs) without reading it, and fix until it passes.
5. Answer with the report's path and its contradictions.

## Output

The report, next to the source.

## Rules

- Write the categories in the order of [categories.md](../references/categories.md).
- Count open gaps only, and set `status: clean` when there are none, else `status: open`.
