# 01 - Scan

Read the project.

## Input

The project root.

## Output

The confirmed capabilities and external tools, printed nowhere.

## Process

1. **Ground.** Read the project against [reading-sources.md](../references/reading-sources.md), and stop when it holds nothing to read.
2. **Find.** Detect the capabilities per [capability-signals.md](../references/capability-signals.md), each with its evidence.
3. **Map.** Detect the external tools per [ecosystem-signals.md](../references/ecosystem-signals.md), which fill the always-on `ecosystem` capability.
4. **Ask.** Show the scan as [scan-summary.md](../assets/scan-summary.md) does. Ask only for missing information or decisions that materially affect the authorized work; otherwise proceed.
5. **Confirm.** Keep what the scan found, plus the user's additions, minus their drops.

## Test

| Case | Pass |
| --- | --- |
| Completion | no file under the project changed |
| Evidence | a capability has an existing path or dependency, or the user's explicit confirmation |
| Summary | one row per capability and per tool, each carrying evidence |
| Tool | one access mode per actor that reaches it |
| Browsing | a configured or user-confirmed browser tool selects browsing; a UI alone does not |
| Authorization | previously supplied information and authorization are not requested again |
| Every run | the same capabilities for the same repo and confirmed choices, bank or no bank |
| Empty repo | the run stops at Ground and hands nothing on |
