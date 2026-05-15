# 04 - Draft SKILL.md router

Write the SKILL.md. Router only - no business logic.

## Inputs

- `skill_name`, `domain_type`, `expected_output`, `invocation_mode` (from 01)
- `action_plan` (from 03)

## Outputs

`<skill>/SKILL.md` produced from `@../../assets/skills/skill-template.md`.

## Process

1. Read `@../../assets/skills/skill-template.md`. Copy its contents to `<skill>/SKILL.md`.
2. Fill the frontmatter per R5 and `references/naming-conventions.md`. If `invocation_mode = manual`, add `disable-model-invocation: true`.
3. Write the action table from the plan: `#`, slug, role, required input.
4. Sequential → chain `01 → 02 → ...`; non-sequential → trigger-to-action mapping.

## Test

`<skill>/SKILL.md` exists; frontmatter has `name` (kebab-case ≤ 64 chars, no reserved word `anthropic`/`claude`) and `description` (non-empty ≤ 1024 chars, contains a "Do NOT use" clause); body ≤ 500 lines; the action table slugs match the `action_plan` from 03; every non-null `expect_action` in `evals/scenarios.json` matches a slug in the action table.
