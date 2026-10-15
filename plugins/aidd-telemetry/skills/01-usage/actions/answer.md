# Answer

Run the framed command and state what it shows, with what it does not know.

## Input

The command from `frame`.

## Output

The figures the report holds for the question, each counter apart, followed by everything the report marks as unknown, unattributed or unread.

## Process

1. **Run.** Run the command and parse its standard output as JSON.
   - A non-zero exit: show its message and stop.
2. **Check.** Read [the envelope reference](../references/envelope.md) for the fields.
   - `refused` present: measurement is refused by the environment. Say so and give no figure.
   - `version` other than `1`: say the report has a shape this skill does not know, and give no figure.
3. **State.** Give the rows and the `totals` as the report holds them: input, output, cache read, cache write and `total`, each with its token count. Name the period and the axis.
4. **Say the unknowns.** Say each of these that applies, in this order:
   - a counter whose `unknown_records` is above `0`: its figure is a lower bound, and that many calls did not report it;
   - `unknown_records` on the totals above `0`: the same for the total;
   - a row of kind `unattributed`: its `reason`, with its meaning from the reference;
   - a row of kind `absent`: that the axis had no value for those calls;
   - `coverage.unrecognised_shapes`, `coverage.skipped_ledger_lines` or any `coverage.not_stored` entry above `0`: that some lines were read and left out, with the counts;
   - `coverage.records` of `0`: that no call is recorded for the period, and why that may be, from the reference.
5. **Bound the past.** When the period starts before `coverage.oldest_transcript_at`, say that Claude Code may have removed older session files, so earlier figures can be incomplete.
6. **Offer the fix.** For work with no task, say it can be attributed afterwards by declaring the task from that branch with `aidd telemetry task <name> [--ticket <ref>]`. Declare nothing yourself.

## Test

| Case | Pass |
| --- | --- |
| A report with `unknown_records` above `0` | The answer says the figure is a lower bound, and never shows `0` for it |
| A report with a `no-binding` row | The answer names the row and what it means |
| A `refused` envelope | No figure is given |
| Every figure in the answer | It appears in the JSON; none was computed here |
