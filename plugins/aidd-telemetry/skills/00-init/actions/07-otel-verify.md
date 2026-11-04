# 07 - Verify provider receipt

Read the CLI's checks of provider configuration and captured telemetry.

## Input

The selected provider and destination, carried from initialization or supplied with a verification request.

## Process

1. Run `aidd telemetry otel verify --help` and report an unavailable command as requiring an update of `@ai-driven-dev/cli`.
2. Obtain any missing provider or destination choice.
3. Run `aidd telemetry otel verify --config=<provider> --endpoint=<destination>`.
4. Report the captured nonempty line count and modification time, or the CLI's failure.
   - Historical records establish previous receipt, not delivery from the current session.
   - If a fresh session has not been run, state that current-session delivery remains unchecked.

## Output

The CLI's configuration and receipt result, with its timing limitation.

## Rules

- Verification is read-only; configuration changes require a separate initialization request.
