# 02 - Plan

Check the command, plan its files and get them approved.

## Input

The draft, name and targets.

## Process

1. Fill [command-template.md](../assets/command-template.md) with the draft into one canonical command, and remove the scaffold.
2. Check it against [command-authoring.md](../references/command-authoring.md), and fix each breach.
3. Plugin source: plan the canonical command's path in [hosts.md](../references/hosts.md).
4. Host tools: write the command's fields and body to the input file, and run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then stop.
5. Present the command, each planned path with its operation, and each dropped field.
6. End the turn and wait for the user's own answer.
   - Revision: apply it, then repeat from step 2.
   - Cancel: stop, cancelled.
7. Read [write](03-write.md) once approved.

## Output

The approved command, input file and paths.

## Rules

- Write nothing in the project.
- Count only an answer given after this plan as its approval.
