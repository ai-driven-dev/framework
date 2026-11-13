# 04 - Validate

Check the written skill and report.

## Input

The files written.

## Process

1. Run [check-skill.cjs](../scripts/check-skill.cjs) on the skill folder, and fix each finding until it exits 0.
2. Review each written file against [skill-authoring.md](../references/skill-authoring.md), and list its breaches, even none.
   - A breach in a file the plan does not list: add it to the plan and confirm it with the user.
3. Find each kept item and each change in the written files with its `file:line`.
   - Unconfirmed addition: list it as a breach.
4. Fix each breach and repeat from step 1 until every list is empty.
   - Fix declined or impossible: report the blocker and stop.
5. Propose a trial per [runtime-validation.md](../references/runtime-validation.md), then wait for approval.
   - Declined, no subagent, or running in a subagent: go to step 7, runtime unverified.
6. Run the approved trial in a subagent and inspect its evidence.
   - Failure: fix and repeat from step 1.
   - Trial scope changed: propose it again first.
7. Report the findings and the runtime status, even when clean.

## Output

The report: each written file's breaches and fixes, and the trial evidence or why runtime is unverified.

## Rules

- Name each finding's rule by its id, with a `file:line`.
