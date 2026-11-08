# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Process

1. Show the sheet once and write the answers into it, as its [Presentation](../assets/fact-sheet.md#presentation) and [Answers](../assets/fact-sheet.md#answers) say.
2. If it holds no fact line and no absent always file, report the bank current and stop.
3. Run `facts` as [engine](../references/engine.md) says, and fix the sheet until it passes.
4. Create the bank tree of [capabilities](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent.
5. Write each file the sheet names plus every absent always file, minus a capability answered no, as [capabilities](../references/capabilities.md#writing) says, at `aidd_docs/memory/<file>`, never under its template folder, from the sheet only, against [memory-rules](../references/memory-rules.md).
6. Lint each file written as [engine](../references/engine.md) says, and fix what it names on the lines you wrote.
7. Run `vanished` as [engine](../references/engine.md) says, report what it lists, change nothing, go on to [sync](04-sync.md).

## Output

The written bank, with no format error.
