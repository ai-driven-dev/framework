# 01 - Load Scope

Lock the smallest defensible acceptance QA scope before execution.

## Input

Acceptance criteria (issue, spec, or user story, or criteria the user gives) and a reference to the reviewed candidate (branch, commit, or running URL).

## Output

- 0 or 1 locked browser happy path,
- a bounded set of sourced browser edge cases, each tied to the criterion it proves,
- every criterion, or quoted part of one, with no browser-observable outcome, listed out of interface,
- every candidate rejected during Validate, with its reason,
- a source label,
- a resolved evidence folder.

## Process

1. **Resolve.** Identify the acceptance criteria for the requested feature (issue, spec, or user story, or criteria the user gives) and the reviewed candidate reference. A plan is never a criteria source.
2. **Filter.** Keep only criteria with a browser-observable outcome. Collect every other criterion into an out-of-interface list, and never test one of them by reading code.
   - Split a partly observable criterion: test the observable part, list the rest out of interface, quoted.
3. **Locate.** Use the existing AIDD feature folder when the source belongs to one. Otherwise use `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/`.
4. **Skip.** When no criterion survived the Filter, fill [qa-report-template.md](../assets/qa-report-template.md) with the source label, verdict `skipped`, and every criterion under Out of interface; write it to `<evidence-folder>/qa.md`; output the verdict and the path, then stop — prerequisites, prepare-run, and run-scenarios never run.
5. **Lock.** Lock 1 browser happy path from the criteria's primary journey.
   - Ask one concise question only when the criteria expose multiple browser journeys or conflict.
6. **Collect.** Include every browser-observable edge case named directly in the acceptance criteria, plus a plan's browser Test Scope edge case only when it maps to one of those criteria.
   - Never derive a candidate edge case from the diff, the source code, or existing tests.
7. **Bound.** Deduplicate candidates against the criteria. Rank the edges the criteria actually support by user impact, browser observability, determinism, and proximity to the requested journey.
   - Never pad the set with a candidate the criteria do not support merely to reach a count.
8. **Decide.** Automatically include a proposed edge only when it is deterministic, browser-observable, in scope, and non-destructive. Require a decision only for an external or destructive action.
9. **Validate.** Reject a scenario without a source criterion, trigger, browser-observable outcome, or executable teardown when it changes state; carry each rejection forward with its reason instead of dropping it.
10. **Show.** Emit `Happy path: locked (<source>)`, one compact `Edge case | Criterion | Decision` table, and, only when non-empty, `Out of interface: <criteria>` and `Rejected: <criterion> — <reason>`. Do not repeat scenario steps.

## Test

- Every locked scenario traces to a criterion from the issue, spec, user story, or the user; a plan is never a criteria source, a plan's Test Scope edge case is admitted only when it maps to one of those criteria, and none is derived from the diff, source code, or existing tests.
- A criterion with no browser-observable outcome is shown as out of interface, never scoped as a scenario; a partly observable one is split, its unobservable part quoted out of interface.
- A scope is shown exactly as defensible, never padded with a candidate the criteria do not support merely to reach a count.
- Conflicting or multiple browser journeys in the criteria produce one concise question, not a guess.
- When no criterion survives the Filter, the run stops here with verdict `skipped`, every criterion under Out of interface, and prerequisites, prepare-run, and run-scenarios never run.
- A candidate rejected in Validate is carried forward with its reason, never dropped silently, even when it empties the locked set.
