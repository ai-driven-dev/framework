# 03 - Write

Write the skill tree from the plan.

## Input

The confirmed plan and target.

## Process

1. Run [scaffold-skill.cjs](../scripts/scaffold-skill.cjs) on the plan, saved as JSON in the schema its header states.
   - No SKILL.md or action file missing: skip this step.
2. Write each file the plan lists at its place in [skill-tree.md](../references/skill-tree.md), per [skill-authoring.md](../references/skill-authoring.md).
   - Existing file: edit it in place.
3. Copy the tree to each other distinct target root of [tool-write.md](../references/tool-write.md).
4. Read [validate](04-validate.md).

## Output

The skill tree at each target, and the list of files written.

## Rules

- Write only relative paths inside the workspace, outside the plugin install directory, under the target, and stop on any other path.
