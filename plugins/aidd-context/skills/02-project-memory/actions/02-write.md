# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Process

1. Show the sheet as [sheet message](../assets/sheet-message.md) shows, with the detected tools as [tools](../references/tools.md) says.
2. Wait for the answer, then write it into the sheet as [Answers](../assets/fact-sheet.md#answers) says.
3. If it holds no fact line and no absent always file, report the bank current and stop.
4. Run `facts` as [engine](../references/engine.md) says, and fix the sheet until it passes.
5. Create the bank tree of [capabilities](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent.
6. Write each file the sheet names plus every absent always file, minus a capability answered no, as [capabilities](../references/capabilities.md#writing) says, at `aidd_docs/memory/<file>`, never under its template folder, from the sheet only, against [memory-rules](../references/memory-rules.md).
7. Lint each file written as [engine](../references/engine.md) says, and fix what it names on the lines you wrote.
8. Run `vanished` as [engine](../references/engine.md) says and change nothing.
9. Go on to [sync](04-sync.md), then reply as [report message](../assets/report-message.md) shows, with what `vanished` listed.

## Output

The written bank, with no format error.
