---
name: verify-payload
description: Verify a bundled payload. Use when the user wants to verify the phase three fixture.
license: MIT
compatibility: Requires a host that can read local files.
metadata:
  fixture: "phase-three"
---

# Verify Payload

```mermaid
flowchart LR
  request([verification request]) --> verify --> answer([verification code])
```

## Actions

Run the flow above. Read only the next action file.

| Action | Does |
| --- | --- |
| verify | verify the bundled payload |

## Transversal rules

- Read [01-verify.md](actions/01-verify.md) before answering.
- Leave project files unchanged.
