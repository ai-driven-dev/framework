# Provider telemetry field mapping

Use this page to see what each provider can emit, what the local collector keeps, and what the development sync actually sends. For the three modes, opt-in and identity rules, start with the [README](README.md#choose-a-mode).

This is an inventory of source fields, not a promise that the AIDD report ingests them. Claude Code and Codex fields below were observed in local OTLP captures; OpenCode 2 fields were observed in its session event stream. OpenCode 1 fields are from its published session schema, not a verified OTLP capture. Presence depends on version, configuration, event and provider. A missing value is unknown, not zero.

The examples are fictional. `C` is Claude Code, `X` is Codex, `O1` is OpenCode 1 and `O2` is OpenCode 2. OTLP attribute names below are keys in the record, span or resource's `attributes` array, not necessarily JSON object properties. For O1, `info` denotes the message in `message.updated`, `part` the part in `message.part.updated`, and session information comes from `session.created` or `session.updated`; these are session-event schemas, not OTLP attributes.

| Common element | Example | Claude Code | Codex | OpenCode (v1 / v2) |
| --- | --- | --- | --- | --- |
| Time | `2026-11-04T10:20:00+08:00` | `event.timestamp`, `timeUnixNano`, `observedTimeUnixNano`; span `startTimeUnixNano` / `endTimeUnixNano` | Same OTLP times | **v1:** `info.time.created`, `part.time.start` / `end`; **v2:** `created`, `data.started` on step start |
| Event type | `tool_result` | `event.name`, log body, span or metric name | `event.name`; `eventName` may instead identify a source location | **v1/v2:** event `type` |
| Application version | `2.2.5` | resource `service.version` | `app.version`, resource `service.version` | **v1:** session `info.version`; **v2:** `data.version` on `session.created` or resource `service.version` |
| Session | `session-abc` | `session.id` | `conversation.id`; trace `thread.id` | **v1:** `info.sessionID`, `part.sessionID`; **v2:** `data.sessionID`, event `durable.aggregateID` |
| Provider | `openai` | `anthropic.provider`, `gen_ai.provider.name`, `gen_ai.system` | `provider_name`, trace `provider` | **v1:** assistant `info.providerID`, user `info.model.providerID`; **v2:** `data.model.providerID` on step start |
| Model | `model-xyz` | `model`, `gen_ai.request.model` | `model` | **v1:** assistant `info.modelID`, user `info.model.modelID`; **v2:** `data.model.id` on step start |
| User input | `Fix the test` | `prompt`, `prompt_text`, span `user_prompt` | `prompt` | **v1:** `part.text` joined by `messageID` to a user message; **v2:** `data.item.payload.text` on `session.inbox.enqueued` with `data.item.type=user` |
| Assistant response | `The test is fixed.` | `response` | `response` | **v1:** `part.text` joined by `messageID` to an assistant message; **v2:** `data.text` on `session.text.ended`, `data.delta` on `session.text.delta` |
| Input tokens | `1,200` | `input_tokens`; `claude_code.token.usage` metric, `type=input` | `input_token_count`, `codex.turn.token_usage.input_tokens`, `gen_ai.usage.input_tokens`; metric `token_type=input` | **v1:** `info.tokens.input` or `part.tokens.input`; **v2:** `data.tokens.input` |
| Output tokens | `350` | `output_tokens`; metric `type=output` | `output_token_count`, `codex.turn.token_usage.output_tokens`, `gen_ai.usage.output_tokens`; metric `token_type=output` | **v1:** `info.tokens.output` or `part.tokens.output`; **v2:** `data.tokens.output` |
| Cache read | `800` | `cache_read_tokens`; metric `type=cacheRead` | `cached_token_count`, `codex.turn.token_usage.cached_input_tokens`, `gen_ai.usage.cache_read.input_tokens`; metric `token_type=cached_input` | **v1:** `info.tokens.cache.read` or `part.tokens.cache.read`; **v2:** `data.tokens.cache.read` |
| Cache write | `200` | `cache_creation_tokens`, `cache_creation_5m_tokens`, `cache_creation_1h_tokens`; metric `type=cacheCreation` | `cache_write_token_count`, `codex.turn.token_usage.cache_write_input_tokens`, `gen_ai.usage.cache_write.input_tokens`; metric `token_type=cache_write_input` | **v1:** `info.tokens.cache.write` or `part.tokens.cache.write`; **v2:** `data.tokens.cache.write` |
| Tool call ID | `call-abc` | `tool_use_id`, `gen_ai.tool.call.id` | `call_id`; trace `runtime_tool_call_id` is distinct | **v1:** `part.callID`; **v2:** `data.id` |
| Tool name | `read_file` | `tool_name`, `gen_ai.tool.name` | `tool_name`; metric `tool` | **v1:** `part.tool`; **v2:** `data.name` on `session.tool.input.started` |
| Tool input | `{"path":"src/app.ts"}` | `tool_parameters`, `tool_input` | `arguments` | **v1:** `part.state.input`; **v2:** `data.input` on `session.tool.called`, serialized `data.text` on `session.tool.input.ended` |
| Tool output | `File contents…` | `output` on span event `tool.output` | `output` on `codex.tool_result` | **v1:** completed `part.state.output`; **v2:** `data.content[].text` on `session.tool.success` |
| Tool outcome | `success` | `success` on tool result | `success` on tool result | **v1:** `part.state.status` and `part.state.error`; **v2:** `session.tool.success` or `session.tool.failed`, with `data.error.type` / `data.error.message` |

Provider labels are not necessarily equivalent across tools. A user role does not prove a human authored the input. Some v1 fields require correlating a part with its message; v2 text and model fields depend on the event type. Codex trace `codex.turn.token_usage.non_cached_input_tokens` is a separate count.

## Interpretation and coverage

- The Claude and Codex metric `type` / `token_type` labels above belong to `claude_code.token.usage` and `codex.turn.token_usage`, respectively. OTLP logs, traces and metrics may describe the same operation; do not add them together.
- OpenCode 2 emits `data.tokens.*` both on `session.step.ended` and `session.usage.updated`. The latter is cumulative; summing every update overcounts. Its `input` is non-cached input and `output` is visible output; reasoning is separate. The implementation maps missing provider usage to zero, so a reported zero does not prove zero usage.
- Claude's `input_tokens` excludes cache reads and writes. Normalize token definitions before comparison; do not assume a similarly named field counts the same thing in all tools.
- In the examined capture, Codex cache-write fields were present but all zero. A nonzero write was not verified. Not every event includes every field; OpenCode 2 text and model data may need correlation across events. Outputs can be truncated.
- Claude can emit `cost_usd`; OpenCode 1 has assistant and step-finish `cost`, and OpenCode 2 exposes step and cumulative cost. A trustworthy equivalent was not established for Codex in the observed captures. These values do not by themselves establish an actual invoice: pricing basis and completeness must be known, and cumulative and per-step figures must not be combined as independent costs.
- A future feature may display an **estimated token cost**, not an invoice. It would require the provider and model, price source and effective date, currency, and rates for input, output, cache reads and cache writes. Subscription, included quota, negotiated and API pricing can differ. If usage, a compatible rate or a billing basis is unknown, the estimate is unknown rather than zero. Cost calculation and pricing are outside this feature.
- A tool session ID is not automatically a feature ID. Feature attribution requires the framework's session/branch declaration and must handle missing or ambiguous bindings. The existing local usage ledger and provider OTLP export are distinct pipelines.
- OpenCode 2's rich session events are SSE, not the observed OTLP logs. The O1 schema above does not prove its fields are emitted over OTLP. The schema event's `durable.version` is not an application major version.
- Prompts, responses, tool arguments and results can contain secrets. Capture and retain them only with the appropriate consent and local access controls.

## What sync sends

The collector keeps the provider's raw OTLP JSON locally. The separate dev sync selects only consented sessions and sends:

- **Claude Code:** `tool_result` logs and selected metrics: token usage, active time, edit decisions, lines changed, sessions, commits, pull requests and the provider's `cost.usage` metric when present. The dashboard does not calculate a cost.
- **Codex:** `conversation_starts`, `tool_result` and `response.completed` events, including available token counts.
- **Both:** available event time, session, model, application version, provider email/account/organization IDs, tool name, call ID, outcome and duration. Confirmed framework feature bindings additionally carry the declared branch and ticket; an invalidation can be sent when a binding becomes ambiguous.

The sync excludes fields for prompt and response text, tool arguments and output, raw API bodies, metric exemplars and traces. It filters attribute keys, not secrets or free text inside allowed values. OpenCode is not forwarded by this sync. These are forwarding rules, not guarantees about what the raw collector receives.

### Example: a Claude metric sent locally

The structure below was produced by `selectTransfers` from one real local Claude capture. The timestamps, metric value, session, organization, email, account, model and query source have been replaced with fictional values; attribute presence varies by event. It is the filtered request body, not the raw capture or its authorization header.

```json
{
  "resourceMetrics": [{
    "scopeMetrics": [{
      "metrics": [{
        "name": "claude_code.token.usage",
        "sum": {
          "aggregationTemporality": 1,
          "isMonotonic": true,
          "dataPoints": [{
            "startTimeUnixNano": "1767225600000000000",
            "timeUnixNano": "1767225660000000000",
            "asDouble": 123,
            "attributes": [
              { "key": "session.id", "value": { "stringValue": "session-example" } },
              { "key": "organization.id", "value": { "stringValue": "organization-example" } },
              { "key": "user.email", "value": { "stringValue": "person@example.test" } },
              { "key": "user.account_id", "value": { "stringValue": "account-example" } },
              { "key": "model", "value": { "stringValue": "model-example" } },
              { "key": "query_source", "value": { "stringValue": "example" } },
              { "key": "type", "value": { "stringValue": "input" } }
            ]
          }]
        }
      }]
    }]
  }]
}
```

## Local Gouvernail sync

OTLP initialization, verification, local collection and sync require private POSIX files and are not supported on Windows.

Start the collector, then configure the tools in another shell:

```sh
aidd telemetry otel collect
# In another shell:
aidd telemetry otel init --config=claude --endpoint=dev
aidd telemetry otel init --config=codex --endpoint=dev
```

Restart the tools to load their settings. With local telemetry measurement enabled, start one sync process per provider:

```sh
# Set the relevant connector token in the environment without putting it in command arguments.
export AIDD_OTEL_TOKEN='<connector token>'
aidd telemetry otel sync --config=claude --tenant=acme --endpoint=http://127.0.0.1:3011 --follow
# In another shell, use the Codex connector token and --config=codex.
```

The origin must be loopback HTTP; no token or prompt content is printed. Only supported observations from sessions admitted by the local ledger and covered by an uninterrupted consent interval are sent. A Claude cumulative metric whose whole interval is not covered is excluded. A successful HTTP response does not prove that Gouvernail matched a member: check its session view.

An automatic follower starts with new capture events and keeps a private checkpoint. Network errors and HTTP 5xx responses are reported and retried with bounded backoff; permanent HTTP failures stop the follower. Restarting resumes from the checkpoint, and a failed post is replayed, so the receiver must remain idempotent. Unknown sessions wait for their transcript to be admitted using private byte-range indexes, without holding up other sessions. These indexes can grow until admission and depend on retaining the original capture; replaced or truncated captures require recovery rather than silently skipping data. Running a follower for each provider is an explicit operation; it does not start automatically after a machine restart. Linked session identifiers and the minimum provider identity are stored privately to detect later ambiguity, including after restart. Older sync state without identity must be refreshed with a session replay.

To replay one consented session already in the capture, pass `--session=<id>` without `--follow`. Add `--follow` to follow only that session. A feature link is sent only when every recorded call agrees on a single observed branch and a declared canonical ticket such as `owner/repo#123`; otherwise it remains unlinked. If a linked session later becomes ambiguous, an irreversible invalidation keeps it unlinked even if events arrive out of order.

## Sources

Read on 2026-11-04:

- [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- [Codex observability and telemetry](https://learn.chatgpt.com/docs/config-file/config-advanced#observability-and-telemetry)
- [OpenCode 1.18.35 session schema](https://github.com/anomalyco/opencode/blob/v1.18.35/packages/schema/src/v1/session.ts) and [LLM instrumentation](https://github.com/anomalyco/opencode/blob/v1.18.35/packages/opencode/src/session/llm.ts)
- [OpenCode 2.2.5 session events](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/schema/src/session-event.ts) and [token normalization](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/core/src/session/usage.ts)
