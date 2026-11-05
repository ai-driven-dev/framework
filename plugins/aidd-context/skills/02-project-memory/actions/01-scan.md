# 01 - Scan

Read the project.

## Input

The project root.

## Output

The confirmed capabilities and external tools.

## Process

1. **Ground.** Read the project against [reading-sources.md](../references/reading-sources.md), and stop when it holds nothing to read.
2. **Find.** Detect the capabilities per [capabilities.md](../references/capabilities.md), each with its evidence.
3. **Map.** Detect the external tools per [ecosystem-signals.md](../references/ecosystem-signals.md), which fill the always-on `ecosystem` capability.
4. **Ask.** Show the scan as [scan-summary.md](../assets/scan-summary.md) does, ask for what the repo cannot prove, and wait.
5. **Confirm.** Keep what the scan found, plus the user's additions, minus their drops.

## Test

| Case | Pass |
| --- | --- |
| Completion | no file changed |
| Summary | one row per capability and per tool, each with evidence that exists |
| Tool | one access mode per actor |
| Repeat | the same capabilities for the same repo, bank or not |
| Empty repo | stops at Ground, hands nothing on |
