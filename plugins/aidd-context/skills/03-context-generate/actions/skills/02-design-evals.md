# 02 - Design evaluations

Write `evals/scenarios.json` so we can probe trigger correctness later.

**Skip condition:** if `invocation_mode = manual` (from 01), skip - manual-only skills have no autonomous trigger. Jump to action 03.

## Inputs

- `invocation_mode` (from 01) - must be `auto`; otherwise skip this action
- `skill_name`, `expected_output` (from 01)
- 3+ realistic user prompts

## Outputs

`evals/scenarios.json` - see `@${CLAUDE_PLUGIN_ROOT}/skills/03-context-generate/assets/skills/evals-template.md` for schema and example.

## Process

1. Ask the user for 3+ realistic prompts (verbatim, not invented).
2. For each prompt, map to an `expect_action` slug - or `null` if the skill must NOT trigger.
3. Write `evals/scenarios.json`.
4. Read scenarios back to the user. Wait for written validation before action 03.

## Test

```bash
# Test: evals/scenarios.json exists under the skill root, parses as JSON array, has >= 3 entries
test -f evals/scenarios.json || exit 1
node -e "const a=require('./evals/scenarios.json'); if (!Array.isArray(a)||a.length<3) process.exit(1);" || exit 1
node -e "const a=require('./evals/scenarios.json'); a.forEach(e=>{if(typeof e.prompt!=='string') process.exit(1);});" || exit 1
echo ok
```
