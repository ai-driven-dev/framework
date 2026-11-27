# 03 - Write

Write the skill tree from the plan.

## Input

The confirmed plan and target.

## Process

1. Repeat the [native frontmatter preview](../references/tool-write.md) for approved native options and stop on a refusal.
2. Run [scaffold-skill.cjs](../scripts/scaffold-skill.cjs) with plan JSON on stdin (`-`), without a plan file.
   - No SKILL.md or action file missing: skip this step.
3. Write each file the plan lists at its place in [skill-tree.md](../references/skill-tree.md), per [skill-authoring.md](../references/skill-authoring.md).
   - Existing file: edit it in place.
4. Copy the portable tree to each other distinct target root of [tool-write.md](../references/tool-write.md), preserving existing target-specific frontmatter.
   - Native options requested: use the portable frontmatter for newly copied targets.
5. Apply the approved native frontmatter per [tool-write.md](../references/tool-write.md) once all selected targets have their `SKILL.md`.
6. Read [validate](04-validate.md).

## Output

The skill tree at each target, and the list of files written.

## Rules

- Write only relative paths inside the workspace, outside the plugin install directory, under the target, and stop on any other path.
