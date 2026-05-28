---
name: aidd-refine:04:shadow-areas
description: Analytical scan of a markdown artifact (idea, user-stories, PRD, spec) to surface blind spots - unstated assumption, missing actor, missing failure mode, ambiguous term, missing acceptance criterion, missing edge case, and missing dependency - emitting a structured shadow report grouped by category and sorted by severity. Use when the user says "find blind spots in this spec", "what's missing in this PRD", "shadow report", "shadow analysis", "scan for gaps", "find what's missing", "spot blind spots", "review for gaps", or asks for an analytical gap scan of a written artifact. Do NOT use for interactive clarification through iterative Q&A (use aidd-refine:01:brainstorm for that), implementing features, writing tests, or reviewing code style.
---

# Shadow Areas

Analytically scans a written artifact for gaps the author has not addressed. Unlike iterative Q&A clarification, this skill reads the existing material and emits a structured report: each gap carries a category from a locked 7-category taxonomy, a 3-tier severity, and a direct-question probe the author can act on immediately.

## Available actions

| #   | Action           | Role                                                                     | Input                                    |
| --- | ---------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| 01  | `detect`         | Parse input, extract gaps, classify category and severity, emit probes   | file path or inline text                 |
| 02  | `render-report`  | Render markdown grouped by category and sorted by severity, write report | gap list from detect                     |
| 03  | `diff`           | Load prior report, classify gaps as closed / still-open / newly-introduced | gap list from detect + prior report path |

## Default flow

Router dispatches by context:

- No prior report present: `01-detect` then `02-render-report`
- Prior report present: `01-detect` then `03-diff` then `02-render-report`

The `02-render-report` action always runs last and writes `<source>-shadow-report.md` next to the source.

## Transversal rules

- Never modify the source artifact.
- Every emitted gap must have all three fields populated: `category`, `severity`, `probe`.
- Every probe must be a direct question ending with `?`.
- Categories and severities must come from the locked sets in `@references/locked-sets.json`.
- When zero blockers and zero majors remain, stamp the report `status: clean`.
- On re-runs, the identity key for diffing is `category + normalized snippet` - not probe wording - so minor probe rephrasing does not create spurious "newly introduced" gaps.

## References

- `@references/categories.md`: locked 7-category taxonomy with definition and example per category.
- `@references/severity-rubric.md`: blocker / major / minor decision rules and examples.
- `@references/probe-style.md`: direct-question form rules.
- `@references/locked-sets.json`: machine-readable sets reused by the validator.

## Assets

- `@assets/report-template.md`: report skeleton with header, per-category sections, and `status: clean` block.

## External data

- None.
