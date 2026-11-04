# Provider telemetry field mapping

This is an inventory of source fields, not a promise that the AIDD report ingests them. Claude Code and Codex fields below were observed in local OTLP captures; OpenCode 2 fields were observed in its session event stream. OpenCode 1 fields are from its published session schema, not a verified OTLP capture. Presence depends on version, configuration, event and provider. A missing value is unknown, not zero.

The examples are fictional. `C` is Claude Code, `X` is Codex, `O1` is OpenCode 1 and `O2` is OpenCode 2. OTLP attribute names below are keys in the record, span or resource's `attributes` array, not necessarily JSON object properties. For O1, `info` denotes the message in `message.updated`, `part` the part in `message.part.updated`, and session information comes from `session.created` or `session.updated`; these are session-event schemas, not OTLP attributes.

| Common element | Data | Example | Source properties |
| --- | --- | --- | --- |
| Time | Event or operation time | `2026-11-04T10:20:00+08:00` | **C/X:** `event.timestamp`, `timeUnixNano`, `observedTimeUnixNano`; spans have `startTimeUnixNano`, `endTimeUnixNano`. **O1:** `info.time.created`, `part.time.start` / `end` when provided. **O2:** `created`, `data.started` on step start. |
| Event type | Kind of event | `tool_result` | **C:** `event.name`, log `body.stringValue`, span or metric name. **X:** `event.name`; `eventName` may identify a source location instead. **O1/O2:** event `type`. |
| Application version | Client version | `2.2.5` | **C:** resource `service.version`. **X:** `app.version`, resource `service.version`. **O1:** session `info.version`. **O2:** `data.version` on `session.created`; OTLP resource `service.version`. |
| Session | Tool-specific session ID | `session-abc` | **C:** `session.id`. **X:** `conversation.id`; trace `thread.id`. **O1:** `info.sessionID`, `part.sessionID`. **O2:** `data.sessionID`; session-event `durable.aggregateID`. |
| Provider | Provider identifier | `openai` | **C:** `anthropic.provider`, `gen_ai.provider.name`, `gen_ai.system`. **X:** `provider_name`, trace `provider`. **O1:** assistant `info.providerID`, user `info.model.providerID`. **O2:** `data.model.providerID` on step start. Provider labels are not necessarily equivalent across tools. |
| Model | Model identifier | `model-xyz` | **C:** `model`, `gen_ai.request.model`. **X:** `model`. **O1:** assistant `info.modelID`, user `info.model.modelID`. **O2:** `data.model.id` on step start. |
| User input | User-role text when captured | `Fix the test` | **C:** `prompt`, `prompt_text`, span `user_prompt`. **X:** `prompt`. **O1:** text part `part.text`, joined to a user-role message via `messageID`. **O2:** `data.item.payload.text` in `session.inbox.enqueued` with `data.item.type=user`. A `user` role alone does not prove a human authored it. |
| Assistant response | Response text | `The test is fixed.` | **C/X:** `response`. **O1:** text part `part.text`, joined to an assistant-role message. **O2:** `data.text` on `session.text.ended`; `data.delta` on `session.text.delta`. |
| Input tokens | Input count | `1,200` | **C:** `input_tokens`; metric `claude_code.token.usage` with `type=input`. **X:** `input_token_count`, `codex.turn.token_usage.input_tokens`, `gen_ai.usage.input_tokens`; metric `codex.turn.token_usage` with `token_type=input`. Trace `codex.turn.token_usage.non_cached_input_tokens` is a separate count. **O1:** assistant `info.tokens.input` or step-finish `part.tokens.input`. **O2:** `data.tokens.input`. |
| Output tokens | Output count | `350` | **C:** `output_tokens`; metric `type=output`. **X:** `output_token_count`, `codex.turn.token_usage.output_tokens`, `gen_ai.usage.output_tokens`; metric `token_type=output`. **O1:** `info.tokens.output` or `part.tokens.output`. **O2:** `data.tokens.output`. |
| Cache read | Tokens read from cache | `800` | **C:** `cache_read_tokens`; metric `type=cacheRead`. **X:** `cached_token_count`, `codex.turn.token_usage.cached_input_tokens`, `gen_ai.usage.cache_read.input_tokens`; metric `token_type=cached_input`. **O1:** `info.tokens.cache.read` or `part.tokens.cache.read`. **O2:** `data.tokens.cache.read`. |
| Cache write | Tokens written to cache | `200` | **C:** `cache_creation_tokens`, `cache_creation_5m_tokens`, `cache_creation_1h_tokens`; metric `type=cacheCreation`. **X:** `cache_write_token_count`, `codex.turn.token_usage.cache_write_input_tokens`, `gen_ai.usage.cache_write.input_tokens`; metric `token_type=cache_write_input`. **O1:** `info.tokens.cache.write` or `part.tokens.cache.write`. **O2:** `data.tokens.cache.write`. |
| Tool call ID | Tool-specific call ID | `call-abc` | **C:** `tool_use_id`, `gen_ai.tool.call.id`. **X:** `call_id`; trace `runtime_tool_call_id` is a separate identifier. **O1:** tool `part.callID`. **O2:** `data.id` on tool events. |
| Tool name | Invoked tool | `read_file` | **C:** `tool_name`, `gen_ai.tool.name`. **X:** `tool_name`; metric label `tool`. **O1:** tool `part.tool`. **O2:** `data.name` on `session.tool.input.started`. |
| Tool input | Tool arguments | `{"path":"src/app.ts"}` | **C:** `tool_parameters`, `tool_input`. **X:** `arguments`. **O1:** tool `part.state.input`. **O2:** `data.input` on `session.tool.called`; serialized `data.text` on `session.tool.input.ended`. |
| Tool output | Returned content | `File contents…` | **C:** `output` on span event `tool.output`. **X:** `output` on `codex.tool_result`. **O1:** completed tool `part.state.output`. **O2:** `data.content[].text` on `session.tool.success`. |
| Tool outcome | Success or failure | `success` | **C/X:** `success` on tool result. **O1:** `part.state.status` (`pending`, `running`, `completed`, `error`); error `part.state.error`. **O2:** event `session.tool.success` or `session.tool.failed`; failure `data.error.type`, `data.error.message`. |

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

## Local Gouvernail sync

With the local OTLP capture already running, start one process per configured provider:

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
