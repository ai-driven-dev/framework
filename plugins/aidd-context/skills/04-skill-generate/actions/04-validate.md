# 04 - Validate

Review the skill and report its static checks and optional runtime trial.

## Input

The files written by write.

## Process

1. Validate each file the plan lists, fix each breach, and repeat until it passes.
   - Read each file with its cited references, flag each breach of [skill-authoring.md](../references/skill-authoring.md), and check that the diagram matches `actions/` (R8) and that each file satisfies the Fill and Always true rows of its kind in [fill-norm.md](../references/fill-norm.md).
   - Every item the plan lists to preserve still holds, else restore it.
   - A breach found in a cited file the plan does not list: add it to the plan, confirm it with the user, then fix it.
   - Unresolved breach: report the blocker and stop only if the user declines or the fix cannot be completed.
2. Propose a concrete trial per [runtime-validation.md](../references/runtime-validation.md), then wait for the user's approval.
   - Declined, no subagent available or run in a subagent: continue at step 4 with runtime unverified.
3. After approval, delegate the agreed trial to a dedicated subagent and inspect its execution evidence.
   - Failed or incomplete trial: fix per step 1, repeat the static review and retry; otherwise report the blocker and stop.
   - Changed trial scope: present the revised proposal and obtain approval before running it.
4. Report the findings and runtime status, even when clean.

## Output

A report, one row per written file: checks, findings or none, and fixes; plus the trial result and evidence, or the reason runtime remains unverified.

## Rules

- Name the broken rule by its id and first words, with a `file:line`, for every finding.
