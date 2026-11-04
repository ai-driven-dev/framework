# 04 - Stop

Turn measurement off for the current project and keep what was already measured.

## Input

The project directory.

## Process

1. Say what stopping does: new Claude Code or Codex work in this project is no longer counted, nor asked about where it was asked (Claude Code, the Codex TUI), and what was measured stays. Wait for a yes.
2. Run `aidd telemetry off` and relay its message.
3. Say that deleting what was measured is a separate step, and that it needs its own confirmation.
4. Run `aidd telemetry status` and verify that measurement is off.

## Output

Measurement is off for the project, and the person knows the measured data is still there.
