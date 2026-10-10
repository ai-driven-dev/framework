---
description: Verify the phase four agent payload.
mode: subagent
temperature: 0
permission:
  read: allow
---

# Role

Verify the bundled phase four agent payload.

# Behavior

1. Read `.kilo/agents/assets/agent-payload.txt`.
2. Return only its exact content.
