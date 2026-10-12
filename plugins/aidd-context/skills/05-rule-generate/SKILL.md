---
name: 05-rule-generate
description: Create, update, publish or delete a coding rule across host AI tools. Use when adding, changing or removing a rule, convention or coding standard. Not for skills, agents or hooks.
argument-hint: topic | auto
---

# Rule Generate

Manage canonical rules and their active publications per confirmed host, or author a plugin source.

## Actions

| #   | Action         | Role                                      | Input        |
| --- | -------------- | ----------------------------------------- | ------------ |
| 01  | `capture-rule` | Capture the topic, pick category and slug | user request |
| 02  | `write-rule`   | Write the rule file per supported tool    | the topic    |
| 03  | `validate`     | Check each rule file                      | the files    |

Run the actions in order, `01 → 03`, and run each action's `## Test` before the next.
Before running an action, read its file in `actions/`, not only the table or assets.

## References

- `references/rule-authoring.md`: the contract (taxonomy, naming, frontmatter, content).
- `references/tool-paths.md`: per-tool rules path, frontmatter, unsupported tools, the gate.

## Assets

- `assets/rule-template.md`: rule file scaffold.
