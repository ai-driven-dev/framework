# 03 - Choose

Keep the direction the user chooses.

## Input

The set, in the showcase.

## Process

1. Give the user the set's page.
   - Ask them to keep, revise or discard each direction.
   - Or to take one cell per axis.
   - Then to paste the copied feedback here.
2. Wait for the feedback.
   - Read the entry with `set`.
   - Leave record entries.
3. Weigh the feedback.
   - Keep: a candidate as it is.
   - Revise: a lead whose comment says what to change.
   - Discard: out.
   - No verdict and no pick: not looked at, so ask before deciding.
   - Picks: each picked axis comes from its variant, and together they make the mix.
   - Several kept: ask the user which one.
4. One kept, no revise, no picks: keep it per [engine](../references/engine.md).
   - Then raise the brand's version per [engine](../references/engine.md).
   - A new brand is recorded the same way.
   - Then read [conclude](04-conclude.md).
5. Otherwise read [propose](02-propose.md) with the mix and the comments.

## Output

The brand kept and the set gone, or the next round asked.
