# 01 - Frame

Draft the agent, its name and its targets.

## Input

A request for a new agent, or an existing agent file to refactor.

## Process

1. Detect the installed tools per [hosts.md](../references/hosts.md).
   - Existing agent file: read it as the source.
   - Existing agent file: keep its host as a target.
2. Draft the role, behavior and output per [agent-authoring.md](../references/agent-authoring.md).
3. Propose one name per [agent-authoring.md](../references/agent-authoring.md).
   - Existing agent: keep its name unless the request renames it.
   - Rename: name the old file for the user to delete, since the writer removes nothing.
4. Propose the detected hosts as where the agent goes, a plugin source as the other choice, changeable at the plan.
5. Read [plan](02-plan.md).

## Output

The draft, name and targets.

## Rules

- Write no file.
- Ask one question at a time, only for a part you cannot propose.
