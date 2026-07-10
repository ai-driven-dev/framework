# 04 - Run

Carry out the reply.

## Input

- The user's reply, per `@../references/run/replies.md`.
- The current decision, its resolved commands or a gap.

## Output

The reply carried out.

## Process

1. **Route.** Carry out the reply per `@../references/run/replies.md`.
2. **Guard.**
   - Run only installed skills.
   - A gap invokes nothing.
   - A MANUAL step is shown, not run.
3. **Tier.** Running a step, apply `@../references/run/tiers.md`.
4. **Return.** On a GUIDED handoff, emit the return line per `@../references/run/return.md`.
5. **Record.** Write the handled step to the ledger per `@../references/state/done-rule.md`.
6. **Loop.** After a run or `OK` walk, re-scan. A read-only reply or umbrella pick does not.

## Test

- `OK` runs AUTO unattended and pauses at each GUIDED.
- A MANUAL step is shown, never run.
- A gap invokes nothing.
- `?`/`back` re-render with no re-scan.
- A GUIDED handoff emits the return line.
