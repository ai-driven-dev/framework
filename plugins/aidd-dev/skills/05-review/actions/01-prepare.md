# 01 - Prepare

Resolve what is reviewed and where it lands, then open this round.

## Input

The arguments, and the plan when one is named.

## Output

A round appended to the report, and the diff the axes read.

## Process

1. **Resolve.** Resolve the diff and the report per [report-contract.md](../references/report-contract.md).
2. **Open.** Append a round from the template `report-contract.md` names, recording the selected axes and filling what is known before they run.
3. **Hand over.** Name the diff and the round the axes write into.

## Test

| Case | Pass |
| --- | --- |
| A fresh report | round 1 appended, its date as the start date |
| A report holding two rounds | a third appended, the header counting 3, the first two unchanged |
| A run naming axes | the round names and runs only those axes |
