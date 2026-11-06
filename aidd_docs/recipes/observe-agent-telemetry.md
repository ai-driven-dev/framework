# Observe agent telemetry locally

This procedure captures provider OpenTelemetry (OTel) for Claude Code, Codex and OpenCode v2. The framework's separate local usage ledger is not the source for the Gouvernail OTel view.

## Steps to observe agent telemetry locally

### 1) ⚙️ Configure

Obtain consent from people whose activity will be observed. Raw local captures can contain prompts, responses, commands, tool output and secrets; restrict access and decide when to delete them.

Start the private development collector first, then configure each tool:

```sh
aidd telemetry otel init --config=claude --endpoint=dev
aidd telemetry otel init --config=codex --endpoint=dev
aidd telemetry otel init --config=opencode --endpoint=dev
```

`dev` requires the existing loopback collector and its private token. `prod` is reserved and refuses configuration until a destination is defined. Restart the OpenCode v2 service after initialization so its process receives the exporter settings.

### 2) 🧪 Run two sessions per tool

Run these from the opted-in project. The examples are the commands used in the local observation, with the isolated test settings omitted. They create separate sessions rather than two turns in the same session.

```sh
for i in 1 2; do
  claude --model haiku --tools "" --output-format json -p "Reply with only GOUVERNAIL-CLAUDE-PROBE-$i."
done

for i in 1 2; do
  codex exec --ephemeral --sandbox read-only --model gpt-6.1-terra \
    -c 'model_reasoning_effort="low"' --json "Reply with only GOUVERNAIL-CODEX-PROBE-$i."
done

# Start the configured OpenCode v2 service separately with authentication enabled.
for i in 1 2; do
  opencode run --server http://127.0.0.1:51394 --format json \
    --model openai/gpt-6-luna "Reply with only GOUVERNAIL-OPENCODE-PROBE-$i."
done
```

The OpenCode example assumes the authenticated service is listening on port `51394` and the client has its credentials. Choose models available to the configured accounts. Claude and Codex emit token usage; in the observed OpenCode v2.2.5 capture, prompt spans contained session IDs but no model or token counts. See the [field inventory](../../plugins/aidd-telemetry/OBSERVABILITY.md).

### 3) ✅ Check receipt

```sh
aidd telemetry otel verify --config=claude --endpoint=dev
aidd telemetry otel verify --config=codex --endpoint=dev
aidd telemetry otel verify --config=opencode --endpoint=dev
```

Verification reports capture line counts and modification times. Old records do not prove delivery from the current sessions. Collection and consent-aware forwarding to Gouvernail are separate; capture alone does not create dashboard rows.

Sources accessed 2026-11-06: [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage), [Codex telemetry](https://learn.chatgpt.com/docs/config-file/config-advanced#what-gets-emitted), [OpenCode v2.2.5 OTLP exporter](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/util/src/observability/otlp.ts).
