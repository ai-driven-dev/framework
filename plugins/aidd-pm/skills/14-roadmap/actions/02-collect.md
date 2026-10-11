# 02 - Collect

Gather the candidate items for the quarter, each with its outcome and its source.

## Input

The confirmed frame, or the new candidates `track` surfaced.

## Output

A candidate list: one row per item with its outcome, theme, source status, estimate when the source holds one, dependencies, and trace.

## Process

1. **Read.** Read every source in [sources](../references/sources.md) that the project holds, within the product scope.
2. **Extract.** Keep, per item, only what its source states: outcome, status, estimate, dependencies, and date.
   - A field the source does not state stays empty.
3. **Trace.** Record the source identity of each item, or `proposal` when it has none.
4. **Group.** Propose themes from the outcomes the sources state, and let the user rename, merge, or split them.
5. **Gap.** Apply [handoffs](../references/handoffs.md) to an item that has no outcome or no framed opportunity.
6. **Show.** Present the list, grouped by theme, and ask what is missing.
   - No candidate found: ask one open question for the outcomes the quarter should serve, then stop.

## Test

| Case | Pass |
| --- | --- |
| The run completes | `git status --porcelain` reads the same after as before |
| An item from a source | its trace names a real Epic path, Product Brief path, ticket id, or decision record |
| An item the user adds | its trace reads `proposal` |
| A source without an estimate | the estimate cell is empty; no size is proposed |
| No source holds a candidate | no list; one open question |
