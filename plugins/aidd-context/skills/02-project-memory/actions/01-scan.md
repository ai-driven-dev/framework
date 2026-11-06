# 01 - Scan

Read the project.

## Input

The project root.

## Output

The fact sheet.

## Process

1. **Ground.** Read the project against [reading-sources.md](../references/reading-sources.md), and stop when it holds nothing to read.
2. **Find.** Detect the capabilities per [capabilities.md](../references/capabilities.md), each with its evidence.
3. **Map.** Detect the external tools per [ecosystem-signals.md](../references/ecosystem-signals.md), which fill the always-on `ecosystem` capability.
4. **Collect.** Unless the request is check, answer from the repository each slot of the files [capabilities.md](../references/capabilities.md) selects into [fact-sheet.md](../assets/fact-sheet.md), skipping a slot the bank answers. Write it to `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_memory-<scope>/facts.md` (`<scope>` is setup or refresh), headed by the found capabilities as `C1 api, C2 auth`. Only what the code cannot say becomes a `Q` line.

## Test

| Case | Pass |
| --- | --- |
| Completion | only the sheet written |
| Sheet | one line per fact, each source exists, at most eight `Q` |
| Repeat | the same capabilities for the same repo, bank or not |
| Empty repo | stops at Ground, hands nothing on |
