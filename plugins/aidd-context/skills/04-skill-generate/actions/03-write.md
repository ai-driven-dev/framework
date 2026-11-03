# 03 - Write

Write the skill tree from the plan.

## Input

- **Plan:** the confirmed action table.
- **Target:** the confirmed destination, or for a modify the existing skill's own location.

## Process

1. Create the shape in [skill-tree.md](../references/skill-tree.md).
2. Fill [skill-template.md](../assets/skill-template.md) against [skill-authoring.md](../references/skill-authoring.md), and strip the scaffold.
3. Fill [action-template.md](../assets/action-template.md) per row against `skill-authoring.md`, placing its success check in the process and its constraints in the rules.
4. Write once per confirmed target, using [tool-write.md](../references/tool-write.md).
5. Check the tree against `skill-tree.md`, read back every written file against the contract, and remove remaining placeholders or scaffold instructions.
6. Continue to [validate](04-validate.md).

## Output

The skill tree at the target, and the list of files written.

## Rules

- **Write only relative paths** inside the workspace, outside the plugin install directory, and under the chosen target; otherwise stop and report the path.
