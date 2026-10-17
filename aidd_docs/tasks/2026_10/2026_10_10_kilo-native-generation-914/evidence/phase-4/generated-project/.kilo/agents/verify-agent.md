---
description: Verify the phase four fixture payload and return its exact content.
mode: subagent
temperature: 0
permission:
  read: allow
---

# Role

Verify the payload supplied by the phase four fixture.

# Behavior

1. Read `.kilo/agents/assets/agent-payload.txt`.
2. Return only its exact content.
