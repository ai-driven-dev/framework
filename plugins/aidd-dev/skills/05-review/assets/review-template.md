---
name: review
description: One review report for a diff, all three axes in one file
argument-hint: N/A
---

# Review: {{feature}}

{{one_line_summary}}

- **Verdict**: {{approve | changes-requested | blocked}}
- **Diff scope**: `{{base}}...{{head}}`
- **Axes run**: {{code, functional, relevancy}}
- **Date**: {{yyyy_mm_dd}}
- **Findings**: {{n_critical}} critical, {{n_warning}} warning, {{n_minor}} minor

Verdict: `approve` = ship it; `changes-requested` = fix the warnings or fixable criticals first; `blocked` = a critical that must not merge. The overall verdict is the strictest across the axes run.

## Code

Clean-code findings on the changed lines (or "Not run").

| Sev | Category | Location | Issue | Suggested fix |
| --- | -------- | -------- | ----- | ------------- |

## Functional

Each acceptance criterion traced to the diff (or "Not run").

| Criterion | Met | Evidence / gap |
| --------- | --- | -------------- |

- **Missing behaviors**: {{criteria with no trace, or "none"}}
- **Unplanned behaviors**: {{diff changes tracing to no criterion, or "none"}}
- **Edge-case gaps**: {{gaps, or "none"}}

## Relevancy

Does the change belong (or "Not run"). Every finding ties to evidence, never an opinion.

| Sev | Lens | Location / rule | Misfit | Suggested fix |
| --- | ---- | --------------- | ------ | ------------- |

## Follow-up

- **Top fixes** (ranked, hand off per complexity to `aidd-dev:07-refactor`, `aidd-dev:02-implement`, or `aidd-dev:08-debug`): {{top_fixes}}
- **Notes**: {{additional_notes}}
