# 01 - Load Scope

## Input

Acceptance criteria and reviewed candidate (branch, commit, URL).

## Output

Criterion-mapped scenarios, exclusions and rejections; source, candidate and evidence folder.

## Process

1. **Resolve.** Use issue, spec, story or user criteria, never plans, diffs or code. Evidence goes beside the source, else `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`.
2. **Filter.** Browser or command observable, never API alone or code inspection. Quote unobservable parts Out of interface; excluded, never rejected or blocking. Empty scope => `skipped`; stop.
3. **Select.** One happy path per journey and criterion-named edges only. Ask for conflicting journeys or effects outside fixtures or irreversible effects; verified fixture teardown is not destructive.
4. **Validate.** Define one observable condition for vague outcomes. Reject missing triggers or unresolvable outcomes with reasons; show scope only for a decision.

## Test

Every scenario traces to a criterion.
