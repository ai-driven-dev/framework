# 06 — Validate against evals

Run the evaluation scenarios and loop until all pass.

## Inputs
- Complete skill directory (from 04, 05)
- `evals/scenarios.json` (from 02)

## Outputs

Validation report. Example:

| type       | prompt                           | expect_action       | actual              | status |
| ---------- | -------------------------------- | ------------------- | ------------------- | ------ |
| should     | Post this update to #engineering | `post-message`      | `post-message`      | PASS   |
| should_not | Send an email to the team        | null (→ gmail)      | null (→ gmail)      | PASS   |
| ambiguous  | Notify the team                  | `ask_clarification` | `ask_clarification` | PASS   |

## Process

1. Run `node scripts/validate-all.js <target-skill-path>` to confirm structural integrity (SKILL.md + actions + evals). If any validator fails, fix before proceeding.
2. Ask the user to restart Claude Code so the new skill loads.
3. For each `should`: send the prompt, verify the skill triggers and dispatches to `expect_action`.
4. For each `should_not`: send the prompt, verify the skill does NOT trigger; verify `competing_skill` does (flag separately if not).
5. For each `ambiguous`: verify the skill asks the question from `note`.
6. On failure, diagnose root cause:
   - Wrong trigger → tighten or broaden `description` (R6).
   - Wrong dispatch → clarify action table or rename action slugs.
   - Wrong output → fix the failing action's `## Process`.
7. Re-run failing scenarios only. Loop until 100% pass.
8. Deliver the report table to the user.

## Test

LLM assertion: report shows 100% pass across all scenarios in `evals/scenarios.json`; no scenario was deleted, softened, or reworded to pass — any invalid scenario was explicitly flagged to the user with reasoning.
