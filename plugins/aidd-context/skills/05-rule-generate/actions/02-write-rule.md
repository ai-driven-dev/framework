# 02 - Write rule

## Input

Approved capture.

## Output

Recorded files/results or refusal.

## Process

1. **Prepare.** Host create/update: serialize approved fields into JSON outside destinations per [tool-paths.md](../references/tool-paths.md).
2. **Publish.** Invoke the installed absolute writer with project, confirmed IDs and operation arguments. Plugin: directly write/delete only the approved source; no host fan-out.
3. **Report.** Record results; report refusals verbatim and stop.

## Rules

- Preserve exact approved bodies, metadata, scope and targets; never regenerate, manually edit canonical metadata/generated outputs, migrate legacy rules or bypass refusals.
