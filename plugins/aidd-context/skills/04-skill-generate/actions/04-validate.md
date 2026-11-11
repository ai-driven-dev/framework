# 04 - Validate

Review the skill and report its static checks and optional runtime trial.

## Input

The files written by write.

## Process

1. Run [check-skill.cjs](../scripts/check-skill.cjs) on the skill folder, fix each error, and repeat until it exits 0.
   - It covers only the rules that need no judgment; a clean run is not a finished review.
2. Review each file the plan lists against [skill-authoring.md](../references/skill-authoring.md) and its kind in [fill-norm.md](../references/fill-norm.md), and write its breach list, even when empty.
   - Check that one fact has one home across files (R22), and that the diagram draws each stop, question and loop an action states (R9).
   - Check that a step uses each Input item and produces each Output item (R14).
   - Every item the plan lists to preserve still holds, else restore it.
   - A breach found in a cited file the plan does not list: add it to the plan, confirm it with the user, then fix it.
   - Fix each breach and repeat from step 1 until every list is empty.
   - Unresolved breach: report the blocker and stop only if the user declines or the fix cannot be completed.
3. Propose a concrete trial per [runtime-validation.md](../references/runtime-validation.md), then wait for the user's approval.
   - Declined, no subagent available or run in a subagent: continue at step 5 with runtime unverified.
4. After approval, delegate the agreed trial to a dedicated subagent and inspect its execution evidence.
   - Failed or incomplete trial: fix it, repeat from step 1 and retry; otherwise report the blocker and stop.
   - Changed trial scope: present the revised proposal and obtain approval before running it.
5. Report the findings and runtime status, even when clean.

## Output

A report, one row per written file: the script's result, the breach list or none, and fixes; plus the trial result and evidence, or the reason runtime remains unverified.

## Rules

- Name the broken rule by its id and first words, with a `file:line`, for every finding.
