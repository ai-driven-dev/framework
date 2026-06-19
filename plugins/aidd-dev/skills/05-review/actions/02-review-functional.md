# 02 - Review Functional

Verify the implemented feature matches the plan's acceptance criteria, flows, and edge cases. Static review of the current diff against plan intent. No app execution, no browser, no code-quality checks. Read-only: surface gaps, never patch them - hand a missing behavior off to `aidd-dev:02-implement`, a broken one to `aidd-dev:08-debug`.

## Inputs

```yaml
plan_path: <path to the plan document>     # required via $ARGUMENTS or prompt
diff_scope: <git ref range>                # optional; defaults to `git diff main`
```

## Outputs

```yaml
review_path: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<task_name>/review-functional.md
criteria_total: <int>
criteria_traced: <int>
missing_behaviors: <int>
unplanned_behaviors: <int>
edge_case_gaps: <int>
```

## Rules

Check against:

- Inconsistencies
- Duplications
- Non logical Flows or Steps


## Process

1. **Read the plan.** Use `plan_path` from `$ARGUMENTS` when provided; otherwise ask the user to supply the acceptance criteria directly.
2. **Extract acceptance criteria.** If they exist in the plan, ask the user to validate them before proceeding. If missing, ask the user to provide them.
3. **Fetch the diff.** Use `diff_scope` when provided; otherwise `git diff main`.
4. **Trace each criterion to the diff.** Fill the scoring matrix with one row per acceptance criterion.
5. **List missing behaviors** (criteria with no trace in the diff).
6. **List unplanned behaviors** (diff changes that trace to no criterion).
7. **List flow and edge-case gaps** surfaced by walking through each criterion.
8. **Format and write** the report using `@../assets/review-functional-template.md` to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<task_name>/review-functional.md`. Reuse the feature folder of the reviewed work when it exists, otherwise create it.

## Test

The report file exists at the emitted `review_path`, contains a scoring matrix with exactly one row per acceptance criterion, and includes explicit `Missing behaviors`, `Unplanned behaviors`, and `Edge-case gaps` sections (empty sections show an explicit "none" rather than being omitted).
