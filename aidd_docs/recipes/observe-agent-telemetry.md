# Observe agent telemetry locally

Configure native telemetry for Claude Code, Codex and OpenCode against the private development collector, then verify receipt.

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

Run a short session with the selected tool, then ask the CLI to check its configuration and captured telemetry:

```sh
aidd telemetry otel verify --config=claude --endpoint=dev
aidd telemetry otel verify --config=codex --endpoint=dev
aidd telemetry otel verify --config=opencode --endpoint=dev
```

Use only the command for the tool you configured. Verification reads the selected tool's local capture and reports its nonempty line count and modification time. Historical records prove previous receipt, not delivery from the current session; compare the reported time with your test session. Follow the CLI's failure message if configuration or captured lines are missing.

Captured files need a retention policy; initialization and verification do not rotate or delete them.
