# 01 - Frame

Draft the agent, its name and its targets.

## Input

A request for a new agent, or an existing agent file to refactor.

## Process

1. Detect the installed tools per [hosts.md](../references/hosts.md).
   - Existing agent file: read it as the source, and keep its tool as a target.
2. Draft the role, behavior and output per [agent-authoring.md](../references/agent-authoring.md), proposing each part or asking one question.
3. Propose one name per [agent-authoring.md](../references/agent-authoring.md).
   - Existing agent: keep its name unless the request renames it.
4. Ask where the agent goes, the detected host tools or a plugin source.
5. Read [plan](02-plan.md).

## Output

The draft, name and targets.

## Rules

- Write no file.
- Ask one question at a time, only for a part you cannot propose.
