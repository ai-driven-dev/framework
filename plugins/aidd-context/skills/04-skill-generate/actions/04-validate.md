# 04 - Validate

Review the skill and report its static checks and optional runtime trial.

## Input

The skill written by write.

## Process

1. Review each file against [review-protocol.md](../references/review-protocol.md).
2. Apply confirmed fixes and repeat step 1 until no breach remains.
   - **Unresolved breach:** report the blocker and stop if a fix is outside the approved scope or cannot be completed.
3. Propose a concrete trial per [runtime-validation.md](../references/runtime-validation.md), then wait for the user's approval.
   - **Already running in a subagent:** return the proposal to the caller without spawning, with runtime unverified.
   - **Declined or no subagent available:** continue at step 5 with runtime unverified.
4. After approval, delegate the agreed trial to a dedicated subagent and inspect its execution evidence.
   - **Failed or incomplete trial:** fix within the approved scope, repeat the static review and retry; otherwise report the blocker and stop.
   - **Changed trial scope:** present the revised proposal and obtain approval before running it.
5. Report the findings and runtime status, even when clean.

## Output

A report, one row per written file: checks, findings or none, and fixes; plus the trial result and evidence, or the reason runtime remains unverified.

## Rules

- **Name the broken rule and a `file:line`** for every finding.
