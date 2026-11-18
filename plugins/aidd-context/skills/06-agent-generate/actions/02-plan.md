# 02 - Plan

Check the agent, plan its files and get them approved.

## Input

The draft, name and targets.

## Process

1. Fill [agent-template.md](../assets/agent-template.md) with the draft.
2. Check it against [agent-authoring.md](../references/agent-authoring.md), and fix each breach.
3. Plugin source: plan the canonical agent's path in [hosts.md](../references/hosts.md).
4. Hosts: write the draft's fields and body to the input file per [writer.md](../references/writer.md).
5. Hosts: run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then stop.
6. Present the plan.
   - The draft.
   - Each planned path with its operation.
   - Each dropped field.
7. End the turn and wait for the user's own answer.
   - Revision: apply it, then repeat from step 2.
   - Cancel: stop, cancelled.
8. Read [write](03-write.md) once approved.

## Output

The approved draft, input file and paths.

## Rules

- Write nothing in the project.
