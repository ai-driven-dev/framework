# 03 - Choose

Read the verdicts the user pastes.

## Input

The pastes.

## Process

1. Read each paste or chat answer.
   - Take its record, its version, and a verdict per state.
   - A paste may list several records.
   - Leave entries with `set`.
   - Two pastes for one record: the latest wins.
   - A paste for another version than the record's: ask again.
   - A state with no verdict: ask before writing.
   - Ok: the state stands.
   - Revise: its comment says what to change.
2. List each record with a revise, and its comments.
   - It goes back for change, then to review again.
3. Read [write](04-write.md).

## Output

- The verdicts of each record.
- The records sent back for change.
