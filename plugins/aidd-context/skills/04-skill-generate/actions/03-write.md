# 03 - Write

Write the skill tree from the plan.

## Input

- The plan from plan.
- The target from scope, or for a modify the existing skill's own location.

## Process

1. Create the shape in [skill-tree.md](../references/skill-tree.md).
2. Fill [skill-template.md](../assets/skill-template.md) against [skill-authoring.md](../references/skill-authoring.md), and strip the scaffold.
   - Modify: revise the existing SKILL.md in place, keeping the user's edits.
3. Fill [action-template.md](../assets/action-template.md) per row against `skill-authoring.md`, placing its success check in the process and its constraints in the rules.
   - Modify: revise a changed action in place, and leave an untouched one alone.
4. Set `argument-hint` per `skill-authoring.md`.
5. Write once per confirmed target, using [tool-write.md](../references/tool-write.md).
6. Read back every written file and remove any remaining placeholders or scaffold instructions.
7. Read [validate](04-validate.md).

## Output

The skill tree at the target, and the list of files written.

## Rules

- Write only relative paths inside the workspace, outside the plugin install directory, and under the chosen target; otherwise stop and report the path.
