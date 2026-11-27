# 02 - Plan

Check the command, plan its files and get them approved.

## Input

The draft, name and targets.

## Process

1. Shape the draft on [command-template.md](../assets/command-template.md): the front matter keys are writer input fields, and the body is the template after its front matter.
2. Check the draft against [command-authoring.md](../references/command-authoring.md), and fix each breach.
3. Plugin source: plan the canonical command's path per [hosts.md](../references/hosts.md).
4. Hosts: write the draft's fields and body to the input file.
   - Requested native options: verify each option and its type in the confirmed host's official documentation, then add it under that host ID per [writer.md](../references/writer.md).
5. Hosts: run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then stop.
6. Present the plan.
   - The draft.
   - Each planned path with its operation.
   - Each dropped field.
   - Each requested native option with its target and official source.
7. End the turn and wait for the user's answer.
   - Revision: apply it, then repeat from step 2.
   - Cancel: stop, cancelled.
8. Read [write](03-write.md) once approved.

## Output

The approved draft, input file and paths.

## Rules

- Write nothing in the project.
- Count only an answer given after this plan as its approval.
