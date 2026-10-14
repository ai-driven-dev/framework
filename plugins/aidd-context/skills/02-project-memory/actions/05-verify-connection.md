# 05 - Verify Connection

Check the assistant's service connections and fill the report.

## Input

The bank in `aidd_docs/memory/`.

## Output

A printed report using [connection-report.md](../assets/connection-report.md).

## Process

1. **Read.** Read `ecosystem.md`, its referenced memory files and `testing.md` to identify required assistant access and targets.
   - No memory bank: report it missing and stop.
2. **Check.** Use the available CLI, MCP or native tools to confirm the account and target, then perform one read per required service.
   - Read browser content or database metadata where relevant.
   - No writes, installs, login flows, configuration changes or secret output.
3. **Report.** Fill `connection-report.md` from observed results, with one row per category.

## Test

| Case | Pass |
| --- | --- |
| Report | all eight categories appear, with observed evidence or a missing access |
| Failed or unavailable read | no success is claimed; other services are still checked |
| Completion | no data, configuration or memory file changed |
