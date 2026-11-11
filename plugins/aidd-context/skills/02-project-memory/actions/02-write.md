# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Process

1. Run [`plan`](../references/engine.md) with the ticked [tools](../references/tools.md) and fix the sheet until it passes. Then send its output as it is, in plain chat text, nothing before or after it. If it says the bank is current, stop, or go on to [sync](04-sync.md) when a tool is ticked.
2. Wait for the answer, then run [`answer`](../references/engine.md) with it, before any memory file. On exit 1, write the answers into the sheet's answer fields by the [Answers](../references/capabilities.md#answers); apply what it leaves to you the same way.
3. If the plan is declined, write nothing and stop.
4. Create the bank tree of [capabilities](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent.
5. Write each file per the [writing rules](../references/capabilities.md#writing), at `aidd_docs/memory/<file>`, never under its template folder, from the sheet only.
6. Lint each file written with [`check`](../references/engine.md): fix each error on the lines you wrote, check each warning against the code and keep a true line.
7. Go on to [sync](04-sync.md).

## Output

The written bank, with no format error.
