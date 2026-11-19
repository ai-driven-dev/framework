# 01 - Probe local measurement

Check that the installed CLI supports local measurement before choosing its action.

## Input

The requested local operation.

## Process

1. Run `aidd telemetry on --help` and check that it lists `--anonymous`.
   - If unavailable, report that `@ai-driven-dev/cli` needs installing or updating and that nothing changed.
2. Continue to the requested action, [start](02-start.md), [identity](03-identity.md), [stop](04-stop.md), or [forget](05-forget.md).

## Output

A supported CLI and the next local action, or the availability failure.
