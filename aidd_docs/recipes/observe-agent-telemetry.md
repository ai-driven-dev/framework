# Observe agent telemetry locally

Run Claude Code, Codex and OpenCode v2 with OpenTelemetry (OTel), then inspect the local Gouvernail dashboard. For OpenCode, an opted-in AIDD plugin converts public session events to OTLP; the standard exporter does not supply the session-linked usage observed by this plugin. The framework's separate local usage ledger is not the source for this view.

## Steps to observe agent telemetry locally

### 1) ⚙️ Prepare the collector destination

Start local Gouvernail and configure each tool's connector. Generate OpenCode's token in Sources for an explicit team and member; issuing a new token replaces the previous OpenCode token for that organization. The member is the token's declared assignee, not proof of the person using it. For each tool, set `AIDD_OTEL_TOKEN` to its connector token in your shell without publishing it. The examples use the local tenant `ai-driven-dev` and loopback port `55857`; adjust them for your setup.

| Tool | Connector token |
| --- | --- |
| Claude Code | Claude Code OTLP connector |
| Codex | Codex OTLP connector |
| OpenCode v2 | OpenCode OTLP connector for the selected team |

`--yes` opts in to capturing and forwarding telemetry from that one execution. `--keep-capture` retains a private local file whose path is printed by the command, including when an execution fails after capture. Raw captures can contain prompts, responses, commands, tool output and secrets: restrict access and delete them when no longer needed. Without this option the temporary capture is removed.

Add `--include-installation-id` to send the existing AIDD installation UUID as an AIDD-added `aidd.installation.id` resource attribute for that execution. It is an installation identifier, not an authenticated person; member association requires a separate authorized mapping. This flag fails if no installation UUID exists. Captures remain provider data and do not contain this added attribute.

### 2) 🧪 Send two messages in each session

Set `AIDD_OTEL_TOKEN` to the corresponding connector token before each command. Choose models available to your accounts. These examples opt in to sending the installation UUID.

```sh
# Claude connector token
aidd telemetry otel run --config claude --model haiku --tenant ai-driven-dev \
  --endpoint http://127.0.0.1:55857 --yes --keep-capture --include-installation-id \
  --follow-up "What word did I ask you to remember?" -- "Remember ORION72. Reply READY."

# Codex connector token
aidd telemetry otel run --config codex --model gpt-6-luna --tenant ai-driven-dev \
  --endpoint http://127.0.0.1:55857 --yes --keep-capture --include-installation-id \
  --follow-up "What word did I ask you to remember?" -- "Remember ORION72. Reply READY."

# OpenCode connector token
aidd telemetry otel run --config opencode --model claude-code/claude-haiku-4-5-20251001 \
  --tenant ai-driven-dev --endpoint http://127.0.0.1:55857 --yes --keep-capture --include-installation-id \
  --follow-up "What word did I ask you to remember?" -- "Remember ORION72. Reply READY."
```

Each command uses an isolated collector and resumes the first session for the follow-up. Claude and Codex persist these conversations in their usual local session history; OpenCode uses a temporary database removed after the run. This history is used only by the tools to resume; Gouvernail receives OTLP, not the tools' session files. Verify both responses when checking continuity: a shared session ID alone does not prove the model used the first message.

The command waits for an OTLP usage observation after each execution. Claude identifies the matching prompt explicitly; OpenCode supplies a completed step and message ID. Codex supplies session-linked usage but no reliable per-prompt join; observations can include additional requests, so do not attribute their totals to a specific prompt. An emitted observation does not guarantee that every requested field is available. `otel init` and the global development collector are a separate configuration path.

### 3) ✅ Check receipt

Open the local AI KPI page and check the session IDs and observed fields. Delivery does not prove that every event was emitted or received. For OpenCode, the plugin reports the selected model and positive normalized token counts in separate events; an ambiguous zero stays unavailable. Missing or uncertain values remain unavailable. See the [field inventory](../../plugins/aidd-telemetry/OBSERVABILITY.md).

```sh
open 'http://localhost:55857/enterprise/ai-driven-dev/kpi/sessions'
```

Sources accessed 2026-11-06: [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage), [Codex telemetry](https://learn.chatgpt.com/docs/config-file/config-advanced#what-gets-emitted), [OpenCode v2 CLI](https://dev.opencode.ai/v2/docs/cli) and [OTLP exporter](https://github.com/anomalyco/opencode/blob/v2.2.5/packages/util/src/observability/otlp.ts).
