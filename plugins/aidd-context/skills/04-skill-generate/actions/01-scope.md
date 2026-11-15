# 01 - Scope

Frame a new skill before any file is touched.

## Input

A request for a skill that does not exist yet.

## Process

1. Detect the installed tools per [hosts.md](../references/hosts.md).
2. Fill [scope-frame.md](../assets/scope-frame.md), proposing each field's value or asking one question.
3. Check the name per the naming table of [skill-authoring.md](../references/skill-authoring.md), and state any overlap with an installed skill, or that none was found.
4. Present the frame.
5. End the turn and wait for the user's own answer.
   - Revision: apply it, then repeat from step 3.
   - Cancel: stop, cancelled.
6. Read [plan](02-plan.md) once confirmed.

## Output

The confirmed frame.

## Rules

- Write no file.
- Ask one question at a time, only for a field you cannot propose.
