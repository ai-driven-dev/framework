---
name: 04-skill-generate
description: Generate a router-based skill across the host AI tools a project uses. Use when the user wants to create, scaffold, or refactor a skill, or turn a workflow into one. Not for other artifacts like rules, agents, commands, hooks.
---

# Skill Generate

Builds one canonical skill from intent and renders it per confirmed host tool, or once as a plugin source.

## Actions

| #   | Action              | Role                                          | Input             |
| --- | ------------------- | --------------------------------------------- | ----------------- |
| 01  | `capture-intent`    | Clarify intent + tools, inventory overlaps    | user request      |
| 02  | `decompose-actions` | Break the skill into atomic testable actions  | what it produces  |
| 03  | `draft-skill`       | Write the SKILL.md router                      | intent + plan     |
| 04  | `write-actions`     | Write each action file from the template       | the plan          |
| 05  | `validate`          | Run each action's Test, aggregate pass/fail    | the skill path    |

Run the actions in order, `01 → 05`, and run each action's `## Test` before the next. In modify mode the tool is fixed by the existing skill's location, so the resolution gate is skipped.

## References

- `references/skill-authoring.md`: the contract (R1-R11, action anatomy, naming).
- `references/tool-paths.md`: per-tool skills path, frontmatter, resolution + write-safety gate.

## Assets

- `assets/skill-template.md`: SKILL.md scaffold.
- `assets/action-template.md`: canonical action scaffold.
