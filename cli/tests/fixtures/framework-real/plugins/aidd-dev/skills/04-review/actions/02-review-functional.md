---
name: review_functional
description: Review feature behavior against plan specification and current diff
argument-hint: Plan path to validate against
model: opus
---

# Functional Review Prompt

## Goal

Verify the implemented feature matches the plan's acceptance criteria, flows, and edge cases. Static review of current diff against plan intent. No app execution, no browser, no code quality checks.

## Rules

- Plan path via `$ARGUMENTS`
- Default diff source: `git diff main`
- Focus on _what_ the feature does, not _how_ it is coded
- Behavioral verification only
- No runtime testing
- One row per acceptance criterion
- Report-only output

### Review template

```markdown
@../assets/review-functional-template.md
```

## Process steps

1. Read plan from `$ARGUMENTS` if provided, else ask user to give functional review criteria directly
2. Extract acceptance criteria from plan
   - If criteria present: ask user to validate them before proceeding
   - If criteria missing: ask user to provide them
3. Fetch current diff: `git diff main` (or argument-provided scope)
4. Map diff behavior to each criterion, fill scoring matrix
5. List missing behaviors (criteria with no trace in diff)
6. List unplanned behaviors (diff changes not traced to any criterion)
7. List flow / edge-case gaps surfaced by criteria walkthrough
8. Format using template
9. Output to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-<task_name>.review_functional.md`
