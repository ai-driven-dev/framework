# 01 - Load Scope

## Input

Acceptance criteria and reviewed candidate (branch, commit, URL).

## Output

Criterion-mapped scenarios, exclusions and rejections; source, candidate and evidence folder.

## Process

1. **Resolve.** Read acceptance criteria from the supplied source, never plans, diffs or code. Save evidence beside the criteria file; otherwise in `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`.
2. **Filter.** Keep browser or CLI criteria. Quote other criteria, including API-only and code inspection, in [Out of interface](../assets/qa-report-template.md#out-of-interface); these exclusions do not block QA. None remain => report `skipped`; stop.
3. **Select.** One happy path per journey and criterion-named edges only. Ask for conflicting journeys or effects outside fixtures or irreversible effects; verified fixture teardown is not destructive.
4. **Validate.** Define one observable condition for vague outcomes. Reject missing triggers or unresolvable outcomes with reasons; show scope only for a decision.

## Test

Every scenario traces to a criterion.
