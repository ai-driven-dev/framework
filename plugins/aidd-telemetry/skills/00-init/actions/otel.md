# Configure provider OpenTelemetry

## Input

The provider (`claude`, `codex` or `opencode`) and destination (`dev` or `prod`) chosen by the person.

## Output

The selected provider and destination, any required restart or version limitation, and whether configuration changed, or the CLI's refusal.

## Process

1. Run `aidd telemetry otel init --help`. If unavailable, say that `@ai-driven-dev/cli` needs installing or updating and that nothing changed.
2. Obtain both choices. Explain that the selected provider sends native OpenTelemetry to the chosen collector and that raw telemetry can contain sensitive data, including secrets. The private development collector listens at `http://127.0.0.1:14318` and requires a bearer token in `~/.local/share/aidd-otel-observation/collector-token`. Production is refused until its destination is configured. This opt-in is separate from the local AIDD usage ledger.
3. Run `aidd telemetry otel init --config=<provider> --endpoint=<destination>` only after the person explicitly requests enabling that export. A request naming the provider and destination is sufficient; do not ask for it again. Let the CLI validate configuration and credentials. Never ask the person to paste a token into chat.
4. Report the configured destination and any warnings or the refusal. Keep credentials and the full merged configuration out of the report. A successful configuration does not establish that the collector received telemetry.

## Test

| Case | Pass |
| --- | --- |
| Missing choice or consent | No init command ran |
| Approved provider and destination | One init command ran with both choices, and its result was reported |
| CLI refused the setup | The refusal was reported without retrying or editing files |
| Production destination unavailable | The CLI's refusal is reported and no configuration is changed |
| Existing local AIDD measurement | No measurement, identity or deletion command runs |
