# Forget

Delete everything measurement keeps on this machine, after showing it and getting a confirmation.

## Input

Nothing. The command covers the whole machine, not one project.

## Output

Either the list of what was removed, or the list of what would be, with nothing removed.

## Process

1. **Preview.** Run `aidd telemetry forget` with no flag. It removes nothing and lists what it would.
   - When it says nothing measured is kept, relay that and stop.
2. **Show.** Give the person the list as the command printed it, with the warnings about repositories it could not reach.
3. **Confirm.** Ask whether to remove all of it. Wait for an explicit yes naming the removal.
   - A no, or no answer, ends the action with nothing removed.
4. **Remove.** Run `aidd telemetry forget --yes` only after that yes, and relay what it printed.
   - It does not turn measurement off: say that `aidd telemetry off` does, and that a project still opted in is measured again from its next session.

## Test

| Case | Pass |
| --- | --- |
| Preview | `aidd telemetry forget` ran without `--yes` and the data is still there afterwards |
| The person declines | `aidd telemetry forget --yes` was never run |
| The person confirms | `aidd telemetry forget --yes` ran once, after the preview, and a second preview lists nothing |
