# 04 - Run

Carry out the user's reply, then loop back to scanning.

## Input

- The reply from `03-present`: a number, `OK`, `?`, `back`, `recap`, `explain`, `skip`, or `stop`.
- The decision from `02-assess`: the resolved commands, or a gap when no installed skill fits.

## Process

1. **Route.** Carry out the reply per `@../references/run/replies.md`.
2. **Guard.** Run or name only skills `01` found installed. A gap invokes nothing: offer explain or stop. Never run a MANUAL step, only show it.
3. **Tier.** When running a step, apply `@../references/run/tiers.md`; the tier is a default, overridable when the skill supports the other mode.
4. **Return.** On a GUIDED handoff, emit the return line per `@../references/run/return.md`.
5. **Record.** Note each handled step in the session ledger per `@../references/state/done-rule.md`.
6. **Loop.** After a step or the `OK` walk runs, re-scan (`→ 01`). A read-only reply or an umbrella pick does not re-scan.

## Test

- `OK` walks the pending steps, runs AUTO unattended, and pauses at each GUIDED for input.
- A MANUAL step is shown, never run; a gap invokes nothing.
- `?`/`back` re-render via `03-present` with no re-scan and no re-assess.
- A GUIDED handoff emits the return line; the re-scan does not re-recommend the handed-off step.
