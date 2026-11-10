# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Process

1. Show the [sheet message](../assets/sheet-message.md) with the detected [tools](../references/tools.md).
2. Wait for the answer, then write it into the sheet's answer fields by the [Answers](../references/capabilities.md#answers), before any memory file.
3. If the plan is declined, write nothing and stop; if it holds no fact line and no absent always file, report the bank current and stop.
4. Run [`facts`](../references/engine.md) and fix the sheet until it passes.
5. Create the bank tree of [capabilities](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent.
6. Write each file per the [writing rules](../references/capabilities.md#writing), at `aidd_docs/memory/<file>`, never under its template folder, from the sheet only.
7. Lint each file written with [`check`](../references/engine.md): fix each error on the lines you wrote, check each warning against the code and keep a true line.
8. Run [`vanished`](../references/engine.md) and change nothing.
9. Go on to [sync](04-sync.md), then reply with the [report message](../assets/report-message.md), with what `vanished` listed.

## Output

The written bank, with no format error.
