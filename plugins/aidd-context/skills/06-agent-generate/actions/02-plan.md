# 02 - Plan

Check the agent, plan its files and get them approved.

## Input

The draft, name and targets.

## Process

1. Fill [agent-template.md](../assets/agent-template.md) with the draft into one canonical agent, and remove the scaffold.
2. Check it against [agent-authoring.md](../references/agent-authoring.md), and fix each breach.
3. Plugin source: plan the canonical agent's path in [hosts.md](../references/hosts.md).
4. Host tools: write the agent's fields and body to the input file, and run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then stop.
5. Present the agent, each planned path with its operation, and each dropped field.
6. End the turn and wait for the user's own answer.
   - Revision: apply it, then repeat from step 2.
   - Cancel: stop, cancelled.
7. Read [write](03-write.md) once approved.

## Output

The approved agent, input file and paths.

## Rules

- Write nothing in the project.
