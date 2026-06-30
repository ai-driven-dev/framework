# 03 - Act

Carry out what the user picked, then loop back to reading the project.

## Input

- The user's choice from `02-orient`.
- The resolved skill, or a gap when no installed skill fits.
- The snapshot from `01-read-project`, held in context.

## Output

One outcome per `@../references/outcomes.md`, always ending with a clear next prompt or a clean stop.

## Process

1. **Act.** Carry out the choice per `@../references/outcomes.md`, running or naming only skills `01` found installed.
2. **Ledger.** Run-it and hand-off refresh the snapshot and mark the step done; a different step marks the declined step skipped; every other outcome reuses the snapshot.

## Test

- Each choice produces its outcome per `@../references/outcomes.md`; only installed skills are run or named.
- Run-it and hand-off mark the step done — not re-suggested even when it left no file behind; a different step marks it skipped; read-only outcomes do not re-read the project.
- A gap never invokes a skill: it offers explain, a different step, or stop only.
