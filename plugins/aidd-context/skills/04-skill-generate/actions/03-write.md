# 03 - Write

Write the skill tree from the plan.

## Input

- The plan from 02.
- The target from 01, or for a modify the existing skill's own location.

## Output

The skill tree at the target, and the list of files written.

## Process

1. **Tree.** Create the shape in `@../references/skill-tree.md`.
2. **Router.** Fill `@../assets/skill-template.md` against `@../references/skill-authoring.md`, strip the scaffold.
   - Modify: revise the existing SKILL.md in place, keeping the user's edits.
3. **Actions.** Fill `@../assets/action-template.md` per row against `@../references/skill-authoring.md`, its test copied from the plan.
   - Modify: revise a changed action in place. Leave an untouched one alone.
4. **Hint.** Set `argument-hint` per `@../references/skill-authoring.md`.
5. **Place.** Write once per confirmed target, using `@../references/tool-write.md`.
6. **Check.** Confirm every written path is relative, inside the workspace, outside the plugin install directory, and under the chosen target. Else stop and report it.

## Test

- SKILL.md holds a `mermaid` flowchart and a three-column action table.
- Every action file contains `## Output`, `## Process`, and `## Test`.
- The written files match `@../references/skill-tree.md`.
