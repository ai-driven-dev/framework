# 03 - Write

Write the skill tree from the plan.

## Input

The confirmed plan and target.

## Process

1. Create the missing folders of [skill-tree.md](../references/skill-tree.md).
2. Write each file the plan lists per [skill-authoring.md](../references/skill-authoring.md), then fill each content slot.
   - Missing files: run [scaffold-skill.cjs](../scripts/scaffold-skill.cjs) on the plan, written as its usage line states.
   - Existing file: edit it in place.
3. Write once per confirmed target, per [tool-write.md](../references/tool-write.md).
4. Read [validate](04-validate.md).

## Output

The skill tree at the target, and the list of files written.

## Rules

- Write only relative paths inside the workspace, outside the plugin install directory, under the target.
  - Any other path: stop and report it.
