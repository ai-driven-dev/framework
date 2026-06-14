← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 07 - skill-generate

Build one canonical skill from intent (a SKILL.md router plus chained actions) and render it once per confirmed host tool. This skill is its own reference implementation: it obeys every rule it ships in `references/skill-authoring.md`.

## When to use

- The user wants to create, scaffold, or refactor a skill.
- Turn an existing workflow into a router-based skill.
- Not for other artifacts (rules, agents, commands, hooks).

## Actions

| #   | Action                                                | Purpose                                       |
| --- | ----------------------------------------------------- | --------------------------------------------- |
| 01  | [capture-intent](actions/01-capture-intent.md)        | Clarify intent + tools, inventory overlaps.   |
| 02  | [decompose-actions](actions/02-decompose-actions.md)  | Break the skill into atomic testable actions. |
| 03  | [draft-skill](actions/03-draft-skill.md)              | Write the SKILL.md router.                     |
| 04  | [write-actions](actions/04-write-actions.md)          | Write each action file from the template.      |
| 05  | [validate](actions/05-validate.md)                    | Run each action's Test, aggregate pass/fail.   |
