# 01 - Frame

Draft the command, its name and its targets.

## Input

A request for a new command, or an existing command file to refactor.

## Process

1. Detect the installed hosts per [hosts.md](../references/hosts.md).
   - Existing command file: read it as the source.
   - Existing command file: keep its host as a target.
   - Only Codex or Antigravity: recommend a skill instead, then stop.
2. Draft the command per [command-authoring.md](../references/command-authoring.md).
   - Breaches C1: recommend a skill instead, then stop.
3. Propose one name per [command-authoring.md](../references/command-authoring.md).
   - Existing command: keep its name unless the request renames it.
   - Rename: name the old file for the user to delete, since the writer removes nothing.
4. Propose the detected hosts as where the command goes, a plugin source as the other choice, changeable at the plan.
5. Read [plan](02-plan.md).

## Output

The draft, name and targets.

## Rules

- Write no file.
- Ask one question at a time, only for a part you cannot propose.
