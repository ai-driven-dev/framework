# 02 - Design evaluations

Write `evals/scenarios.json` so we can probe trigger correctness later.

**Skip condition:** if `invocation_mode = manual` (from 01), skip - manual-only skills have no autonomous trigger. Jump to action 03.

## Inputs

- `invocation_mode` (from 01) - must be `auto`; otherwise skip this action
- `skill_name`, `expected_output` (from 01)
- 3+ realistic user prompts

## Outputs

`evals/scenarios.json` - see `@assets/skills/evals-template.md` for schema and example.

## Process

1. Ask the user for 3+ realistic prompts (verbatim, not invented).
2. For each prompt, map to an `expect_action` slug - or `null` if the skill must NOT trigger.
3. Write `evals/scenarios.json`.
4. Read scenarios back to the user. Wait for written validation before action 03.

## Test

`evals/scenarios.json` exists, parses as a JSON array, has at least 3 entries, each entry has a string `prompt` and an `expect_action` (slug string or `null`).
