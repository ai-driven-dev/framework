# Observe agent telemetry locally

Run Claude Code, Codex and OpenCode v2 with OpenTelemetry (OTel), then inspect the local Gouvernail dashboard. For OpenCode, an opted-in AIDD plugin converts public session events to OTLP; the standard exporter does not supply the session-linked usage observed by this plugin. The framework's separate local usage ledger is not the source for this view.

## Steps to observe agent telemetry locally

### 1) ⚙️ Prepare the collector destination

Start local Gouvernail and configure each tool's connector. OpenCode's connector is generated in the Sources page for an explicit team. For each tool, set `AIDD_OTEL_TOKEN` to its connector token in your shell without publishing it. The examples use the local tenant `ai-driven-dev` and loopback port `55857`; adjust them for your setup.

| Tool | Connector token |
| --- | --- |
| Claude Code | Claude Code OTLP connector |
| Codex | Codex OTLP connector |
| OpenCode v2 | OpenCode OTLP connector for the selected team |

`--yes` opts in to capturing and forwarding telemetry from that one execution. `--keep-capture` retains a private local file whose path is printed by the command, including when an execution fails after capture. Raw captures can contain prompts, responses, commands, tool output and secrets: restrict access and delete them when no longer needed. Without this option the temporary capture is removed.

### 2) 🧪 Run two sessions per tool

Set `AIDD_OTEL_TOKEN` to the corresponding connector token before each pair. Choose models available to your accounts.

```sh
# Claude connector token must be set before this pair.
for i in 1 2; do
  aidd telemetry otel run --config claude --model haiku --tenant ai-driven-dev \
    --endpoint http://127.0.0.1:55857 --yes --keep-capture -- "Reply with only CLAUDE-$i."
done

# Codex connector token must be set before this pair.
for i in 1 2; do
  aidd telemetry otel run --config codex --model gpt-5.6-luna --tenant ai-driven-dev \
    --endpoint http://127.0.0.1:55857 --yes --keep-capture -- "Reply with only CODEX-$i."
done

# OpenCode connector token must be set before this pair.
for i in 1 2; do
  aidd telemetry otel run --config opencode --model claude-code/claude-haiku-4-5-20251001 \
    --tenant ai-driven-dev --endpoint http://127.0.0.1:55857 --yes --keep-capture -- "Reply with only OPENCODE-$i."
done
```

Each command launches a separate session with an isolated collector. The OpenCode command loads the AIDD plugin for that run. It does not read the framework usage ledger or establish a repository or feature association. `otel init` and the global development collector are a separate configuration path; they are not required for these commands.

### 3) ✅ Check receipt

Open the local AI KPI page and check the session IDs and observed fields. Delivery does not prove that every event was emitted or received. For OpenCode, the plugin reports the selected model and positive normalized token counts in separate events; an ambiguous zero stays unavailable. Missing or uncertain values remain unavailable. See the [field inventory](../../plugins/aidd-telemetry/OBSERVABILITY.md).

```sh
open 'http://localhost:55857/enterprise/ai-driven-dev/kpi/sessions'
```

Sources accessed 2026-11-06: [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage), [Codex telemetry](https://learn.chatgpt.com/docs/config-file/config-advanced#what-gets-emitted), [OpenCode v2 CLI](https://dev.opencode.ai/v2/docs/cli) and [OTLP exporter](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/util/src/observability/otlp.ts).
