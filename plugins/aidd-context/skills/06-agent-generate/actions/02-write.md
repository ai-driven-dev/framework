# 02 - Write

Render the confirmed agent once per target and write it.

## Input

The confirmed draft, name and targets.

## Process

1. Fill [agent-template.md](../assets/agent-template.md) with the draft into one canonical agent, and remove the scaffold.
2. Apply each host tool's frontmatter and conversion per [tool-paths.md](../references/tool-paths.md).
   - Plugin source: keep the canonical agent as is.
3. Announce each path, then write each file at its target's path.
4. Read [validate](03-validate.md).

## Output

The files written.

## Rules

- Write only relative paths inside the workspace, and stop on any other path.
