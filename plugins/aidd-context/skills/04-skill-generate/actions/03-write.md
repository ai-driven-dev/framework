# 03 - Write

Write the skill tree from the plan.

## Input

- **Plan:** the confirmed action table.
- **Target:** the confirmed destination, or for a modify the existing skill's own location.

## Process

1. Create the shape in [skill-tree.md](../references/skill-tree.md).
2. Fill [skill-template.md](../assets/skill-template.md) per [fill-norm.md](../references/fill-norm.md), and strip the scaffold, adding the risk step to the frontmatter only when the plan records one.
   - **Modify:** edit the existing file in place, fill a template only for a file the plan adds, and keep each item the plan lists to preserve, changing its form only.
3. Fill [action-template.md](../assets/action-template.md) per row per `fill-norm.md`, placing its success check in the process and its constraints in the rules.
4. Write once per confirmed target, using [tool-write.md](../references/tool-write.md).
5. Check the tree against `skill-tree.md`, read back every written file against [skill-authoring.md](../references/skill-authoring.md), and remove remaining placeholders or scaffold instructions.
6. Read [validate](04-validate.md).

## Output

The skill tree at the target, and the list of files written.

## Rules

- **Write only relative paths** inside the workspace, outside the plugin install directory, and under the chosen target; otherwise stop and report the path.
