# 04 - Validate

Review the skill and report its static checks and optional runtime trial.

## Input

The skill written by write.

## Process

1. Validate each file per [review-protocol.md](../references/review-protocol.md), fix each breach, and repeat until it passes.
   - **Modify:** every item the plan lists to preserve still holds, else restore it.
   - **Unresolved breach:** report the blocker and stop if a fix is outside the approved scope or cannot be completed.
2. Propose a concrete trial per [runtime-validation.md](../references/runtime-validation.md), then wait for the user's approval.
   - **Already running in a subagent:** return the proposal to the caller without spawning, with runtime unverified.
   - **Declined or no subagent available:** continue at step 4 with runtime unverified.
3. After approval, delegate the agreed trial to a dedicated subagent and inspect its execution evidence.
   - **Failed or incomplete trial:** fix within the approved scope, repeat the static review and retry; otherwise report the blocker and stop.
   - **Changed trial scope:** present the revised proposal and obtain approval before running it.
4. Report the findings and runtime status, even when clean.

## Output

A report, one row per written file: checks, findings or none, and fixes; plus the trial result and evidence, or the reason runtime remains unverified.

## Rules

- **Name the broken rule and a `file:line`** for every finding.
