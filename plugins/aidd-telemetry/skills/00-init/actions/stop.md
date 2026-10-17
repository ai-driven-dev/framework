# Stop

Turn measurement off for the current project and keep what was already measured.

## Input

The project directory.

## Output

Measurement is off for the project, and the person knows the measured data is still there.

## Process

1. **Confirm.** Say what stopping does: new Claude Code work in this project is no longer counted or asked about, and what was measured stays. Wait for a yes.
2. **Turn off.** Run `aidd telemetry off` and relay its message.
3. **Offer the rest.** Say that deleting what was measured is a separate step, and that it needs its own confirmation.

## Test

| Case | Pass |
| --- | --- |
| The person does not confirm | No `aidd telemetry off` was run |
| Confirmed | The command's message was relayed and the data was not deleted |
