# 01 - Frame

Settle the command's goal, name and targets before any file is touched.

## Input

A request for a new command, or an existing command file to refactor.

## Process

1. Detect the installed tools per [hosts.md](../references/hosts.md).
   - Existing command file: read it as the source, and keep its tool as a target.
2. Draft the goal and steps per [command-authoring.md](../references/command-authoring.md), proposing each part or asking one question.
   - Supporting files or ten steps or more: recommend a skill instead, then stop.
3. Propose three names per [command-authoring.md](../references/command-authoring.md), and have the user pick one.
   - Existing command: keep its name unless the request renames it.
4. Ask where the command goes, the detected host tools or a plugin source.
5. Present the draft, the name and the targets, then end the turn and wait for the user's own answer.
6. Read [write](02-write.md) once confirmed.

## Output

The confirmed draft, name and targets.

## Rules

- Write no file.
- Ask one question at a time, only for a part you cannot propose.
- Include a model, an agent or a tool restriction only when the user names one.
