---
status: done
---

# Instruction: `coverage` and `run` apart

## Architecture projection

```txt
cli/src/contexts/telemetry/application/report/report-usage-use-case.ts   ✏️ ReportCoverage {records, leftOut}, ReportRun
cli/src/contexts/telemetry/application/report/report-envelope.ts         ✏️ version 2, run last, refused v2
cli/src/presentation/display/telemetry/telemetry-report-display.ts       ✏️ reads both, same text
```
