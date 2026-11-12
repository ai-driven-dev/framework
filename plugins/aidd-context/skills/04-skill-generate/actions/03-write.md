# 03 - Write

Write the skill tree from the plan.

## Input

The confirmed plan and target.

## Process

1. Create the missing folders of [skill-tree.md](../references/skill-tree.md).
2. Write each file the plan lists per [fill-norm.md](../references/fill-norm.md): edit it in place, or start a missing `SKILL.md` from [skill-template.md](../assets/skill-template.md) and a missing action from [action-template.md](../assets/action-template.md).
3. Write once per confirmed target, per [tool-write.md](../references/tool-write.md).
4. Read [validate](04-validate.md).

## Output

The skill tree at the target, and the list of files written.

## Rules

- Write only relative paths inside the workspace, outside the plugin install directory, under the target; otherwise stop and report the path.
