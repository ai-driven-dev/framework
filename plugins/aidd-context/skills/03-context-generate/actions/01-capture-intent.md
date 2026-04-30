# 01 — Capture intent

Clarify what the user wants before any file is touched. Never assume.

## Inputs
- Free-form user request about creating or modifying a skill.

## Outputs

The six decisions this action produces. They are held in conversation context and passed to actions 02+ as-is. **Not written to any file** — this block is illustrative, not a frontmatter schema.

```text
intent           = generate | modify
skill_name       = <kebab-case name following R5>
domain_type      = tool | activity
expected_output  = <one-sentence description of what the skill produces when run>
sequential       = true | false
location         = local | global
```

Example for a Slack posting skill:

```text
intent           = generate
skill_name       = slack
domain_type      = tool
expected_output  = "Posts a formatted message to a Slack channel and confirms delivery."
sequential       = false
location         = local
```

## Process

1. Ask: "Create a new skill or modify an existing one?"
2. If `modify` → `ls` the skill dir, read its `SKILL.md`, then jump to action 03.
3. If `generate`:
   - Ask for the skill's single purpose in one sentence.
   - If the user mentions multiple unrelated domains, propose a split into separate skills.
4. Pick `domain_type`: external tool/API → `tool`; practice (review, plan...) → `activity`; ambiguous → ask.
5. Validate name per `references/naming-conventions.md`.
6. Check collisions: `ls {{TOOLS}}/skills/`. No overlap in name or triggers.
7. Ask if execution order is strict. If yes → numbered prefixes in action 05.
8. Ask: "Local to this repo (`<repo>/.claude/skills/<name>/`) or global (`~/.claude/skills/<name>/`)?" **Default = local.** Build where the user works now; move to global later only when the user asks. Never infer `global` from "I want to use it in other repos too" — that intent is satisfied by copying the local skill later.
9. Run the skill-vs-command heuristic from `references/skill-vs-command.md`. Single-action skill → recommend a slash command and stop.

## Test

LLM assertion: all five outputs are set and confirmed by the user in writing; name + domain_type follow R5; collision check was run; skill-vs-command heuristic was applied.
