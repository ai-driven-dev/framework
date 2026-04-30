# 02 — Design evaluations

Write evaluation scenarios BEFORE implementation. Core of TDD.

## Inputs
- `skill_name`, `expected_output` (from 01)
- Realistic prompts from the user: ≥ 3 `should`, ≥ 3 `should_not`, ≥ 1 `ambiguous`.

## Outputs

`evals/scenarios.json` — see `assets/evals-template.md`. Example shape (for a hypothetical `slack` skill):

```json
[
  { "type": "should",     "prompt": "Post this update to #engineering",   "expect_action": "post-message" },
  { "type": "should_not", "prompt": "Send an email to the team",          "expect_action": null, "competing_skill": "gmail" },
  { "type": "ambiguous",  "prompt": "Notify the team",                    "expect_action": "ask_clarification", "note": "Ask which channel" }
]
```

## Process

1. Ask the user for realistic prompts — never invent them.
2. For each `should`: map to an `expect_action` slug.
3. For each `should_not`: fill `competing_skill` (use `"none"` if none exists).
4. For each `ambiguous`: set `expect_action: "ask_clarification"` and describe the expected question in `note`.
5. Write `evals/scenarios.json`.
6. Read scenarios back to the user and wait for validation before action 03.

## Test

```bash
node scripts/validate-evals.js <target-skill-path>
```
