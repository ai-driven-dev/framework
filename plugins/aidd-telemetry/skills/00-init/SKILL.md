---
name: 00-init
description: Configure and verify provider OpenTelemetry or manage local AIDD measurement. Use when the user wants to enable export, check receipt, start or stop usage measurement, change their identity, or delete measured data. Not for usage reports.
argument-hint: provider export | verify receipt | local measurement | my name | stop | delete
---

# Init

```mermaid
flowchart TD
  export(["provider export"]) --> init["actions/06-otel-init.md"]
  receipt(["verify receipt"]) --> verify["actions/07-otel-verify.md"]
  init -->|"configured"| verify
  init -->|"declined or unavailable"| unchanged(["nothing changed"])
  verify --> result(["reported CLI result"])
  local(["local usage measurement"]) --> probe["actions/01-probe.md"]
  probe -->|"CLI unavailable"| unchanged
  probe -->|"start"| start["actions/02-start.md"]
  probe -->|"identity"| identity["actions/03-identity.md"]
  probe -->|"stop"| stop["actions/04-stop.md"]
  probe -->|"delete"| forget["actions/05-forget.md"]
  start -->|"consent given"| result
  start -->|"declined"| unchanged
  identity --> result
  stop -->|"confirmed"| result
  stop -->|"declined"| unchanged
  forget -->|"confirmed"| result
  forget -->|"declined or empty"| unchanged
```

## Transversal rules

- Keep provider export and local usage measurement separate; run only the requested path.
- Apply changes through `aidd telemetry`, with the person's explicit authorization for that operation.
- Report command output and warnings with credentials redacted; a non-zero exit ends the action without retrying with other flags.
- Use only identifiers supplied by the person, rather than deriving one from git, the machine or the session.
