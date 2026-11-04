# 05 - Forget

Delete local usage measurement after a preview and explicit confirmation. This command does not delete provider OTLP captures, OTLP sync state, installation UUID or data already received by Gouvernail.

## Process

1. Run `aidd telemetry forget` with no flag. It removes nothing and lists what it would.
   - When it says nothing measured is kept, relay that and stop.
2. Give the person the list as the command printed it, with the warnings about repositories it could not reach.
3. Ask whether to remove all of it. Wait for an explicit yes naming the removal.
   - A no, or no answer, ends the action with nothing removed.
4. Run `aidd telemetry forget --yes` only after that yes, and relay what it printed.
   - Say that it also ends local usage measurement until the person runs `aidd telemetry on`; provider exporters and raw OTLP collection may still run.
5. Run `aidd telemetry forget` again and check that its preview lists nothing remaining.

## Output

Either the list of what was removed, or the list of what would be, with nothing removed. Separately name OTLP captures and Gouvernail data as not removed. Gouvernail production is not implemented here; the requested future policy disallows production deletion and is not enforced by this local command.
