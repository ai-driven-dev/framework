# 04 - Stop

Turn measurement off for the current project and keep what was already measured.

## Input

The project directory.

## Process

1. Say what stopping does: new Claude Code or Codex work in this clone is no longer counted, nor asked about where it was asked (Claude Code, the Codex TUI), and what was measured stays. It does not disable provider OTLP exporters or the raw collector. Wait for a yes.
2. Run `aidd telemetry off` and relay its message.
3. Run `aidd telemetry status` and verify that measurement is off. Report the result by scope in the table below. The CLI does not report the exact stop timestamp; do not invent one. Previously consented observations can still be processed or sent after `off`.
4. Say that deleting what was measured is a separate step, and that it needs its own confirmation. If the person wants raw OTLP to stop too, explain that `off` does not do that: the exporter and collector must be stopped separately, and there is no automatic restore command in this feature.

## Output

| Scope | Result after `off` | Since | Existing data |
| --- | --- | --- | --- |
| Local usage for this clone | Stopped if the command and status confirm it | Exact time not reported by the CLI | Retained |
| OTLP export and raw local collection | Not stopped by `off`; current process state is unknown unless separately checked | Unknown | Captures retained |
| OTLP sync to local Gouvernail | New events outside consent are not eligible; previously consented events may still be sent | Consent interval closes on `off`; exact time not reported | Already received data retained |
| Gouvernail production | Not available in this feature | Not applicable | Not managed by this command |
