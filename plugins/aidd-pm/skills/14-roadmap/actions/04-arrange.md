# 04 - Arrange

Place the items the user prioritizes into the quarter, by theme and by month or horizon.

## Input

The confirmed frame and the candidate list, or the progress report of a replan.

## Output

An approved arrangement: each kept item with its theme, placement, commitment, and trace, plus the items left out.

## Process

1. **Ask.** Ask the user which outcomes matter most this quarter, and in what order.
   - Offer only the order signals the sources support, per [placement](../references/placement.md), with no default.
2. **Place.** Put each kept item in the month or horizon the user gives, per [placement](../references/placement.md).
   - Replan: show each flagged item next to its current placement, and let the user move, keep, or drop it.
3. **Commit.** Ask the commitment level of each item, per [placement](../references/placement.md).
4. **Fit.** Compare the summed estimates of each month or horizon with the capacity, when both are known.
   - Either is unknown: state that fit cannot be checked, and ask whether to continue.
   - Overload: name the month and the gap, and let the user cut, move, or accept it.
5. **Confirm.** Show the arrangement as a table, then the items left out, and fold corrections until approved.

## Test

| Case | Pass |
| --- | --- |
| The run completes | `git status --porcelain` reads the same after as before |
| An item placed | its placement and commitment were given by the user, never inferred |
| A proposal placed | it keeps its `proposal` trace |
| Capacity or estimates missing | no fit verdict; the gap is stated |
| An overload | the month and the gap are named; no item is moved without the user |
| Replan | every flagged item has a user decision: move, keep, or drop |
