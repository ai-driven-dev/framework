# 02 - Write

Write the memory the project deserves.

## Input

The sheet.

## Process

1. Promote answered `Q` lines to `R` with the exact answer and source `user`; keep unanswered `Q` lines.
   - Record explicit user-requested edits as `D` with source `user`.
   - Mark a destructive line yes only if prior approval names that change; `user` source alone is not approval.
   - Run [`plan`](../references/engine.md) with the ticked [tools](../references/tools.md). Fix errors, then send its output unchanged in plain chat text.
2. Reuse earlier answers only for matching choices.
   - Apply the [answer defaults](../references/capabilities.md#answers). Showing the plan is not a request for approval; ask only about material choices still open.
   - Run [`answer`](../references/engine.md) only with a relevant user reply. Copy each `Q` reply into an `R` fact with source `user`, then re-run `plan`. On exit 1, copy explicit answers into the sheet and leave the rest blank.
   - Never invent a `Q` answer. A general go-ahead before the plan does not approve `remove`, `replace` or `move`; an earlier explicit approval naming that change, or `ok` to the shown plan, does. Preserve prior `no` answers through replans; reverse one only on the user's explicit instruction.
3. If the plan is declined, write nothing and stop; if it holds no fact line, no absent always file and no added tool, report the bank current and stop.
4. Create the bank tree of [capabilities](../references/capabilities.md). Copy `aidd_docs/README.md` only when absent.
5. Write each file per the [writing rules](../references/capabilities.md#writing), at `aidd_docs/memory/<file>`, never under its template folder, from the sheet only.
6. Lint each file written with [`check`](../references/engine.md): fix each error on the lines you wrote, check each warning against the code and keep a true line.
7. Go on to [sync](04-sync.md).

## Output

The written bank, with no format error.
