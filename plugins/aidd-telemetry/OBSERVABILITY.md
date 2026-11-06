# Provider OpenTelemetry

Gouvernail's AI KPI view uses provider OpenTelemetry (OTel) observations only. The framework's existing local usage ledger is separate and is not sent as OTel. A provider observation is not proof that every event was delivered; missing or ambiguous data remains unavailable.

| Field | Claude Code OTel | Codex OTel | OpenCode v2 OTel |
| --- | --- | --- | --- |
| Session | `session.id`, when present | `conversation.id`, when present | In the `url.path` of observed `/api/session/{id}/prompt` HTTP spans |
| Model | `model`, when present | `model`, when present | Not yet established for all signals |
| Usage | `claude_code.token.usage` and `api_request` | `codex.sse_event` and turn traces | Not established in the observed OTLP capture |
| Identity | Provider attributes, when emitted | Provider attributes, when emitted | Not yet established |

Token fields are provider-specific. Claude's input excludes cache reads and writes; Codex's input includes cached input. A Codex cache zero can mean the provider omitted cache details. Never add a log, metric and trace describing the same usage, or treat an absent value as zero.

`otel run --yes` captures one provider execution in isolation and forwards supported observations and allowlisted attributes to loopback Gouvernail. It neither reads the local usage ledger nor asserts a clone or feature association. With `--keep-capture`, raw private files can contain sensitive content. See [the local setup recipe](../../aidd_docs/recipes/observe-agent-telemetry.md).

In a local OpenCode v2.2.5 capture, two prompt spans included a session ID in their HTTP path; no model or token counts were observed. This observation does not establish that every OpenCode signal includes a session ID. OpenCode session-event feeds and session exports are not provider OTLP and are not used in this view. Production export remains disabled until authenticated user identity and the destination are implemented.

## Sources

Read 2026-11-06:

- [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Codex telemetry configuration](https://learn.chatgpt.com/docs/config-file/config-advanced#what-gets-emitted)
- [OpenCode v2.2.5 OTLP exporter](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/util/src/observability/otlp.ts)
- [OpenCode v2 HTTP API audit](https://github.com/anomalyco/opencode/blob/dev/V2_HTTP_API_AUDIT.md) (current development branch; the v2.2.5 path was observed locally)
- [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- [OTLP protocol](https://opentelemetry.io/docs/specs/otlp/)
