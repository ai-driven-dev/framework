# Provider OpenTelemetry

Gouvernail's AI KPI view uses OpenTelemetry (OTel) observations. For OpenCode v2, an opted-in AIDD plugin converts public OpenCode server events into OTLP; these are not emitted by OpenCode's standard OTLP exporter. The framework's existing local usage ledger is separate and is not sent as OTel. An observation is not proof that every event was delivered; missing or ambiguous data remains unavailable.

| Field | Claude Code OTel | Codex OTel | OpenCode v2 OTel |
| --- | --- | --- | --- |
| Session | `session.id`, when present | `conversation.id` in logs; `thread.id` in observed turn spans | In observed `/api/session/{id}/prompt` HTTP spans and plugin session events |
| Model | `model`, when present | `model`, when present | Selected model and variant on plugin step-start events, when emitted; not proof of the served model or effective effort |
| Usage | Forwarded `claude_code.token.usage` metrics and technical fields from `api_request` events | `codex.sse_event` and turn traces | OpenCode-normalized input, output, reasoning and cache counts from plugin step-end events; ambiguous zero stays unavailable |
| Identity | Provider attributes when emitted, or an explicit connector-token assignment | Provider attributes when emitted, or an explicit connector-token assignment | An explicit connector-token assignment |

Token fields are provider-specific. Claude's input excludes cache reads and writes; Codex's input includes cached input. A Codex cache zero can mean the provider omitted cache details. Never add a log, metric and trace describing the same usage, or treat an absent value as zero.

In local Gouvernail, an assigned connector token binds a tool to a declared member, team and installation UUID. This is not proof of the person holding the token. Older shared tokens retain declarative attribution.

`otel run --yes` captures one provider execution in isolation and forwards supported observations and allowlisted attributes to loopback Gouvernail. It neither reads the local usage ledger nor asserts a clone or feature association. With `--keep-capture`, raw private files can contain sensitive content. See [the local setup recipe](../../aidd_docs/recipes/observe-agent-telemetry.md).

In two local OpenCode v2.2.5 executions before the plugin was added, the raw OTLP contained 1,335 spans, 276 logs and no metric batches. A prompt span in each execution included a session ID in its HTTP path; no session-linked model, effort or token attributes were observed. Five other HTTP spans per execution contained that session ID but were not forwarded. The prompt spans had no trace-linked descendants in these captures; the model and usage spans belonged to a separate server trace without a session ID. A startup log included the requested model, but no session ID or proof of the model actually used. Those runs forwarded only the validated prompt span. These observations do not prove what other versions or configurations emit.

The opt-in OpenCode v2 plugin subscribes to `session.created`, `session.step.started`, `session.step.ended` and `session.step.failed`, and exports each event separately as OTLP logs. It includes the original event and session IDs, message ID when present, selected model and variant at step start, and positive OpenCode-normalized counters at step end. A creation event can also carry an OpenCode project ID and parent session ID; neither is a repository name. It does not export prompts, responses, tool contents or cost. The plugin stream can miss events; event IDs allow deduplication of observations received, not proof of complete delivery. Do not match retries solely by assistant message ID. Production export remains disabled.

For the locally tested `claude-code` provider, OpenCode v2.2.5 documents that its HTTP request and response hooks do not run because Claude Code makes the API calls. Those hooks therefore cannot recover an ambiguous cache zero for this provider. [OpenCode Claude Agent limitations](https://github.com/anomalyco/opencode/blob/v2.2.5/specs/v2/claude-agent-provider.md#limitations) (read 2026-11-07).

## Additional coverage investigated

| Provider | Available or observed in OTLP | Current limit and next step |
| --- | --- | --- |
| Claude Code | The documented `api_request` event can carry request and prompt IDs, model, effort and separate token and cache counters. These fields appeared in both local captures and are forwarded when valid. | The receiver compares request and metric counts; it does not add the two signals. Missing or conflicting observations remain unavailable. Repository attributes require a separate opt-in. |
| Codex | In two local turns with CLI 0.166.0, a `session_task.turn` span contained `thread.id`, `turn.id`, selected model, effort and turn usage together. | The span counts the session usage delta during the turn and may cover several requests or models. The model is selected, not confirmed for every request. Cache and output zeros can be normalized defaults. A turn ID can recur during recovery; retain trace and span IDs. `otel run` sends allowlisted turn spans after session logs; generic `otel sync` does not yet forward these spans. Never add those counters to response-event counters. |
| OpenCode v2 | The v2.2.5 exporter emits logs and traces. In our captures, session HTTP spans and model/usage spans did not share a usable correlation. | The opted-in plugin sends session-linked OpenCode events as OTLP. Missing counters are normalized to zero upstream, so zeros cannot establish actual usage. A model variant is not necessarily reasoning effort. |

An observed effort is evidence only for its own observation. Do not carry it into a later session or an unlinked event, and do not equate a requested model with a confirmed response model.

In one two-prompt Claude capture, the second request's input and cache-read metric series started one millisecond before the cache-creation series, although `api_request` reported all three counts together. The dashboard does not join metric windows by temporal proximity. It can display the observed input including cache when the deduplicated request counts agree with each corresponding metric count. Event delivery can still be incomplete. [Claude event correlation](https://code.claude.com/docs/en/monitoring-usage#event-correlation-attributes) (read 2026-11-07).

## Sources

Read 2026-11-06:

- [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Claude Code API request event](https://code.claude.com/docs/en/monitoring-usage#api-request-event)
- [Codex telemetry configuration](https://learn.chatgpt.com/docs/config-file/config-advanced#what-gets-emitted)
- [OpenCode v2.2.5 OTLP exporter](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/util/src/observability/otlp.ts)
- [OpenCode v2.2.5 usage projection](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/core/src/session/projector.ts#L81-L110)
- [OpenCode v2.2.5 session events](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/schema/src/session-event.ts#L333-L389) and [usage normalization](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/core/src/session/usage.ts#L8-L19)
- [OpenCode v2 server plugins](https://dev.opencode.ai/v2/docs/build/plugins/server) and [retry handling](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/core/src/session/runner/llm.ts#L229-L334)
- [OpenCode v2 HTTP API audit](https://github.com/anomalyco/opencode/blob/dev/V2_HTTP_API_AUDIT.md) (current development branch; the v2.2.5 path was observed locally)
- [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
- [OTLP protocol](https://opentelemetry.io/docs/specs/otlp/)

Read 2026-11-07: [Codex 0.166.0 turn span and counters](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core/src/tasks/mod.rs#L369-L382), [turn counter capture](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core/src/tasks/mod.rs#L760-L810) and [cache defaulting](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/codex-api/src/sse/responses.rs#L131-L153).
