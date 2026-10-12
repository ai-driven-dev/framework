---
name: 05-rule-generate
description: Create, update, publish or delete a coding rule across host AI tools. Use when adding, changing or removing a rule, convention or coding standard. Not for skills, agents or hooks.
argument-hint: topic | auto
---

# Rule Generate

Manage canonical rules and their active publications per confirmed host, or author a plugin source.

## Actions

| #   | Action                  | Role                                        | Input               |
| --- | ----------------------- | ------------------------------------------- | ------------------- |
| 01  | `capture-rule`          | Confirm intent, scope and destinations       | user request        |
| 02  | `assess-existing-rules` | Compare the complete candidate and resolve   | confirmed intent    |
| 03  | `write-rule`            | Publish the approved candidate or selection  | approved resolution |
| 04  | `validate`              | Check the resolved result                    | affected files      |

For create/update, run `01 → 04`, and run each action's `## Test` before the next. Explicitly confirmed publish/delete runs `01 → 03 → 04`; it does not draft or assess a new candidate. Keeping existing rules or cancelling in 02 ends without writing.
Before running an action, read its file in `actions/`, not only the table or assets.

## References

- `references/rule-authoring.md`: the contract (taxonomy, naming, frontmatter, content).
- `references/tool-paths.md`: per-tool rules path, frontmatter, unsupported tools, the gate.

## Assets

- `assets/rule-template.md`: rule file scaffold.
