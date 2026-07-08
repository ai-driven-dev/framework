# 03 - Run

Carry out the user's reply per its tier, then loop back to scanning.

## Input

- The user's reply from `02-report`: a step number (`[1]`…), `OK`, `?`, an explain request, a recap request, or stop.
- The resolved command per line, or a gap when no installed skill fits.
- The snapshot from `01-scan`, held in context.

## Process

1. **Route.** Carry out the reply per `@../references/run-tiers.md`: `OK` walks the pending steps, a number runs one step (or re-renders an idle-menu umbrella's member sub-list), `?` expands the full detail, and `?`, explain, recap, and stop stay read-only.
2. **Guard.** Run or name only skills `01` found installed. A gap never invokes a skill: offer explain or stop. Never run a MANUAL step, only show it.
3. **Record.** Note each handled step in the session ledger per the Done rule in `@../references/checks.md`: a step run, a MANUAL step shown and left, or one the user skips. The next scan then drops it even when disk cannot prove it.
4. **Loop.** After any step or the `OK` walk runs, re-scan (`→ 01`) and re-render so a resolved `✗` flips to `✓`. A read-only reply does not re-scan.

## Output

One outcome per `@../references/run-tiers.md`, always ending with the refreshed report or a clean stop.

## Test

- `OK` walks the whole list, runs AUTO steps unattended, and pauses at each GUIDED step for input rather than running it unattended.
- A MANUAL step is shown, never run; a gap invokes nothing.
- After a step or the `OK` walk runs, the re-scan flips resolved statuses; a read-only reply does not re-scan.
- After a MANUAL step is shown and left, or a step is skipped, the re-scan does not re-recommend it.
