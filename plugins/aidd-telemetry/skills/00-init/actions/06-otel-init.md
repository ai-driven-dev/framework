# 06 - Initialize provider export

Merge native OpenTelemetry settings into the selected provider's local configuration.

## Input

The provider (`claude`, `codex` or `opencode`) and destination (`dev` or `prod`) chosen by the person.

## Process

1. Run `aidd telemetry otel init --help` and report an unavailable command as requiring an update of `@ai-driven-dev/cli`.
2. Obtain both choices and explain the separate opt-in: native telemetry goes to the selected collector and can include prompts, responses, commands and tool output. The provider's user-level export can cover other projects; the raw collector does not check clone consent. The separate sync checks consent before forwarding.
   - The CLI's development endpoint is `http://127.0.0.1:14318`. Start the collector with `aidd telemetry otel collect`; it creates the private token. Initialization does not start it.
   - Production is refused. `https://gouvernail.eu` is an intended future destination, not a configured endpoint; requiring an authenticated person there is a future requirement, not enforced today.
3. Run `aidd telemetry otel init --config=<provider> --endpoint=<destination>` after an explicit request enabling that export.
   - A request naming both choices is sufficient authorization.
   - Let the CLI validate configuration and credentials without requesting a token in chat.
4. Report whether configuration changed and relay the CLI's restart or launch instructions. OpenCode major version 1 needs the launch command printed by the CLI to supply the endpoint and token; major version 2 needs its service restarted.
5. Continue to [verify receipt](07-otel-verify.md) after the person runs a short session with the selected provider.

## Output

The configured provider and destination, or the CLI's refusal.

## Rules

- Keep the merged configuration and credentials out of the report.
- Configuration success alone establishes no receipt of telemetry.
