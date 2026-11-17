# 02 - Propose

Put each lesson to the user with its destination.

## Input

The lessons, each with its cited passage and existing coverage.

## Process

1. Fill [proposal-table.md](../assets/proposal-table.md) with one row per lesson, its destination per [destinations.md](../references/destinations.md).
   - Row skipped in an earlier `learn.md` of the task: leave it out.
   - Lesson that fits a file and a generation: pick one per the choosing rule.
2. Present the table, then end the turn and wait for the user's own answer, a decision per row.
   - Modified: apply the change to the row.
3. Every row skipped: say so, then stop.
4. Read [write](03-write.md).

## Output

The rows the user validated or modified, and those skipped.

## Rules

- Write no file.
- Ask nothing but the decision per row, and offer no other destination.
