# 01 - Frame

Settle the agent's role, name and targets before any file is touched.

## Input

A request for a new agent, or an existing agent file to refactor.

## Process

1. Detect the installed tools per [hosts.md](../references/hosts.md).
   - Existing agent file: read it as the source, and keep its tool as a target.
2. Draft the role, behavior and output per [agent-authoring.md](../references/agent-authoring.md), proposing each part or asking one question.
3. Propose three names per [agent-authoring.md](../references/agent-authoring.md), and have the user pick one.
   - Existing agent: keep its name unless the request renames it.
4. Ask where the agent goes, the detected host tools or `plugins/<plugin>/agents/`.
5. Confirm the draft, the name and the targets with the user, then read [write](02-write.md).

## Output

The confirmed draft, name and targets.

## Rules

- Write no file.
- Ask one question at a time, only for a part you cannot propose.
- Include a model only when the user names one.
