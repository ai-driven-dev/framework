# 06 - Initialize provider export

Merge native OpenTelemetry settings into the selected provider's local configuration.

## Input

The provider (`claude`, `codex` or `opencode`) and destination (`dev` or `prod`) chosen by the person.

## Process

1. Run `aidd telemetry otel init --help` and report an unavailable command as requiring an update of `@ai-driven-dev/cli`.
2. Obtain both choices and explain that native telemetry goes to the selected collector and can include sensitive data.
   - The development collector and its private token must already exist; initialization does not start it.
   - Production is refused until its destination is configured.
3. Run `aidd telemetry otel init --config=<provider> --endpoint=<destination>` after an explicit request enabling that export.
   - A request naming both choices is sufficient authorization.
   - Let the CLI validate configuration and credentials without requesting a token in chat.
4. Report whether configuration changed and relay the CLI's restart or launch instructions.
5. Continue to [verify receipt](07-otel-verify.md) after the person runs a short session with the selected provider.

## Output

The configured provider and destination, or the CLI's refusal.

## Rules

- Keep the merged configuration and credentials out of the report.
- Configuration success alone establishes no receipt of telemetry.
