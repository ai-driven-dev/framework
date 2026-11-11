# 03 - Write

Write the skill tree from the plan.

## Input

- Plan: the confirmed table.
- Target: the confirmed destination. An existing skill enters at plan with no tool question, so it keeps its own target.

## Process

1. Create what is missing of the shape in [skill-tree.md](../references/skill-tree.md).
2. Write `SKILL.md` per [fill-norm.md](../references/fill-norm.md), adding the risk step to the frontmatter only when the plan records one.
3. Write each action file, placing its success check in the process and its constraints in the rules.
4. Write each reference, asset and script the plan lists, per `fill-norm.md`.
5. Write once per confirmed target, using [tool-write.md](../references/tool-write.md).
6. Check the tree against `skill-tree.md`, read back every written file against [skill-authoring.md](../references/skill-authoring.md), and remove remaining placeholders or scaffold instructions.
7. Read [validate](04-validate.md).

## Output

The skill tree at the target, and the list of files written.

## Rules

- Write only relative paths inside the workspace, outside the plugin install directory, and under the chosen target; otherwise stop and report the path.
- An existing target skill is edited in place: keep every item the plan lists to preserve, never rebuild from the plan. Without one, fill the templates ([skill-template.md](../assets/skill-template.md), [action-template.md](../assets/action-template.md)).
