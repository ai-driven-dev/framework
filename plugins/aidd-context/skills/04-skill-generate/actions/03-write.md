# 03 - Write

Write the skill tree from the plan.

## Input

- **Plan.** The plan from 02.
- **Target.** The target from 01, or for a modify the existing skill's own location.

## Output

The skill tree at the target, and the list of files written.

## Process

1. **Tree.** Create the shape in [skill-tree.md](../references/skill-tree.md).
2. **Router.** Fill [skill-template.md](../assets/skill-template.md) against [skill-authoring.md](../references/skill-authoring.md).
   - **Modify.** Revise the existing SKILL.md in place, keeping the user's edits.
3. **Actions.** Fill [action-template.md](../assets/action-template.md) per row, weaving its success check into the process.
   - **Modify.** Revise changed actions in place; leave untouched ones alone.
4. **Hint.** Set `argument-hint` per [skill-authoring.md](../references/skill-authoring.md).
5. **Place.** Write once per confirmed target using [tool-write.md](../references/tool-write.md), stopping if a path escapes the workspace or target or enters a plugin install directory.
6. **Read back.** Check the tree and every file against the contract, removing placeholders and scaffold instructions before validation.
