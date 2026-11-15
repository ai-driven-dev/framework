# 01 - Frame

Draft the command, its name and its targets.

## Input

A request for a new command, or an existing command file to refactor.

## Process

1. Detect the installed tools per [hosts.md](../references/hosts.md).
   - Existing command file: read it as the source, and keep its tool as a target.
   - Only Codex or Antigravity: recommend a skill instead, then stop.
2. Draft the command per [command-authoring.md](../references/command-authoring.md), proposing each part or asking one question.
   - Breaches C1: recommend a skill instead, then stop.
3. Propose one name per [command-authoring.md](../references/command-authoring.md).
   - Existing command: keep its name unless the request renames it.
4. Ask where the command goes, the detected host tools or a plugin source.
5. Read [plan](02-plan.md).

## Output

The draft, name and targets.

## Rules

- Write no file.
- Ask one question at a time, only for a part you cannot propose.
