# 01 - Load Scope

Lock the smallest defensible browser QA scope before execution.

## Input

The user request, plus a feature folder, plan path, or implementation artifact.

## Output

One locked happy path, a bounded set of sourced edge cases, a source label, and a resolved evidence folder.

## Process

1. **Resolve.** Resolve the exact requested feature and batch-read its plan plus directly referenced implementation artifacts.
2. **Lock.** Lock one happy path from the explicit user journey, then the plan Test Scope, then observable acceptance criteria in the implementation artifact. Ask one concise question only when those sources conflict or expose multiple journeys.
3. **Collect.** Include every planned edge case. Collect candidates from explicit validation, error, empty-state, permission, boundary, or recovery branches already visible in the implementation artifact. Search directly related tests only when the plan contains no edge case.
4. **Bound.** Deduplicate candidates against planned edges. Keep at most three proposed edges, ranked by user impact, browser observability, determinism, and proximity to the requested journey.
5. **Decide.** Automatically include a proposed edge only when it is deterministic, browser-observable, in scope, and non-destructive. Require a decision only for an external or destructive action.
6. **Validate.** Reject a scenario without a source, trigger, observable outcome, or executable teardown when it changes state.
7. **Locate.** Use the existing AIDD feature folder when the source belongs to one. Otherwise use `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`.
8. **Show.** Emit `Happy path: locked (<source>)` and one compact `Edge case | Source | Decision` table. Do not repeat scenario steps.

## Test

- Exactly one happy path is locked with a source and observable outcome.
- Every planned edge case is included.
- At most three proposed edges remain; each has a distinct source, trigger, observable outcome, and decision.
- Every state-changing scenario has an executable teardown or reset.
- The source label and evidence folder are resolved whether the source is a plan, implementation artifact, or user request.
- The user-facing output contains one lock line and one edge-case table only.
