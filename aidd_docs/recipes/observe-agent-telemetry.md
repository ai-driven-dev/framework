# Observe agent telemetry locally

Configure native telemetry for Claude Code, Codex and OpenCode against the private development collector, then compare observed fields.

## Steps to observe agent telemetry locally

### 1) 🔒 Check the destination

Telemetry may contain prompts, replies, commands, tool results and secrets. Use it only with the consent of those being observed, protect access to the logs and decide when to delete them. The CLI changes the selected tool's user configuration; this is separate from the per-clone `aidd telemetry on` usage ledger.

| Destination | Availability | Behavior |
| --- | --- | --- |
| `dev` | Private test machine with the existing loopback collector | Configure the selected tool to export locally |
| `prod` | Reserved for a future Gouvernail collector | Refuse without changing files until its destination is defined |

The development collector and its private token must already exist. Initialization does not start a collector or set up a production endpoint.

### 2) ⚙️ Initialize each tool

Run the command for each tool you intend to observe. Existing settings must be preserved; repeat initialization without adding duplicate entries. Follow the CLI's output for version-specific limitations and restarts.

```sh
aidd telemetry otel init --config=claude --endpoint=dev
aidd telemetry otel init --config=codex --endpoint=dev
aidd telemetry otel init --config=opencode --endpoint=dev
```

OpenCode v1 reads the OTLP destination and headers from the process environment. After initialization, launch it through `aidd telemetry otel run --config=opencode` and pass any OpenCode arguments after `--`. OpenCode v2 supports user service environment configuration and requires a service restart. The v1 `experimental.openTelemetry` option enables AI SDK instrumentation; v2.2.5 rejects that option. Native OTLP logs and traces are distinct from the v2 session SSE stream. See the [v1 instrumentation](https://github.com/anomalyco/opencode/blob/v1.19.5/packages/opencode/src/session/llm.ts#L343-L355), [v2 configuration](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/core/src/config/normalize.ts#L46) and [v2 OTLP exporter](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/util/src/observability/otlp.ts), accessed 2026-11-04.

Claude and Codex also support native OTLP logs, metrics and traces; Claude tracing is beta. See [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage) and [Codex observability](https://learn.chatgpt.com/docs/config-file/config-advanced#observability-and-telemetry), accessed 2026-11-04.

### 3) 🧪 Verify receipt

Run a short test session and a non-destructive tool, then check that the relevant local file grows. OpenCode session SSE and native OTLP are separate captures; the SSE capture depends on a running subscriber.

```sh
for file in "$HOME/.local/share/aidd-otel-observation/claude.jsonl" \
  "$HOME/.local/share/aidd-otel-observation/codex.jsonl" \
  "$HOME/.local/share/aidd-otel-observation/opencode.jsonl" \
  "$HOME/.local/share/aidd-otel-observation/opencode/events.jsonl"; do
  if [ -f "$file" ]; then wc -l "$file"; fi
done
```

A configured exporter does not prove delivery. Existing sessions may need restarting. OpenCode SSE misses events during disconnection and does not cover another server or `--standalone` session.

### 4) 📊 Compare observed fields

| Field | Claude Code | Codex | OpenCode v2 SSE |
| --- | --- | --- | --- |
| Session | `session.id` | `conversation.id` | `data.sessionID` |
| Model | `model` | `model` | `data.model.id` |
| Input / output tokens | `input_tokens` / `output_tokens` | `input_token_count` / `output_token_count` | `data.tokens.input` / `data.tokens.output` |
| Cache reads | `cache_read_tokens` | `cached_token_count` | `data.tokens.cache.read` |
| Tool activity | `tool_result` | `codex.tool_result` | `session.tool.input.started`, `session.tool.success` |

These fields were observed in local samples, not guaranteed in every session. Align token definitions before comparing them: for example, Claude input excludes cache reads and writes. OpenCode v2 can turn unavailable token values into zero, so zero is not proof of no usage. See [Claude token counters](https://code.claude.com/docs/en/monitoring-usage) and [OpenCode usage normalization](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/core/src/session/usage.ts), accessed 2026-11-04.

Files grow without automatic rotation. Configuration and receipt do not establish a Gouvernail integration; forwarding, normalization and retention remain future work.
