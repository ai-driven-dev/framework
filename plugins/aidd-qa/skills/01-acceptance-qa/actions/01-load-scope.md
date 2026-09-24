# 01 - Load Scope

Lock the smallest defensible acceptance QA scope before execution.

## Input

Acceptance criteria (issue, spec, or plan) and a reference to the reviewed candidate (branch, commit, or running URL).

## Output

- 1 locked browser happy path,
- a bounded set of sourced browser edge cases, each tied to the criterion it proves,
- every criterion with no browser-observable outcome, listed out of interface,
- a source label,
- a resolved evidence folder.

## Process

1. **Resolve.** the acceptance criteria for the requested feature (issue, spec, or plan) and the reviewed candidate reference.
2. **Filter.** Keep only criteria with a browser-observable outcome. Collect every other criterion into an out-of-interface list, and never test one of them by reading code.
3. **Lock.** Lock 1 browser happy path from the criteria's primary journey.
   - Ask one concise question only when the criteria expose multiple browser journeys or conflict.
4. **Collect.** Include every browser-observable edge case named directly in the acceptance criteria, plus the plan's browser Test Scope when one exists.
   - Never derive a candidate edge case from the diff, the source code, or existing tests.
5. **Bound.** Deduplicate candidates against the criteria. Rank the edges the criteria actually support by user impact, browser observability, determinism, and proximity to the requested journey.
   - Never pad the set with a candidate the criteria do not support merely to reach a count.
6. **Decide.** Automatically include a proposed edge only when it is deterministic, browser-observable, in scope, and non-destructive. Require a decision only for an external or destructive action.
7. **Validate.** Reject a scenario without a source criterion, trigger, browser-observable outcome, or executable teardown when it changes state.
8. **Locate.** Use the existing AIDD feature folder when the source belongs to one. Otherwise use `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`.
9. **Show.** Emit `Happy path: locked (<source>)`, one compact `Edge case | Criterion | Decision` table, and, only when non-empty, `Out of interface: <criteria>`. Do not repeat scenario steps.

## Test

- Every locked scenario traces to a criterion; none is derived from the diff, source code, or existing tests.
- A criterion with no browser-observable outcome is shown as out of interface, never scoped as a scenario.
- A scope with fewer than 3 defensible edge cases is shown exactly as defensible, never padded to reach a count.
- Conflicting or multiple browser journeys in the criteria produce one concise question, not a guess.
