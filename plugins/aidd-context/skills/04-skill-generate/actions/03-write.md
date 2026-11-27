# 03 - Write

Write the skill tree from the plan.

## Input

The confirmed plan and target.

## Process

1. Apply the approved target writes per [tool-write.md](../references/tool-write.md).
2. Read [validate](04-validate.md).

## Output

The skill tree at each target, and the list of files written.

## Rules

- Write only relative paths inside the workspace, outside the plugin install directory, under the target, and stop on any other path.
