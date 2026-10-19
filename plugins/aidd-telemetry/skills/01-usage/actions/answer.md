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
   - `version` other than `2`: the CLI and this plugin read different envelope versions. Give no figure, and name the fix: below `2`, update the CLI (`@ai-driven-dev/cli`); above `2`, update the `aidd-telemetry` plugin, so both are on the same version.
3. **State.** Give the rows and the `totals` as the report holds them: input, output, cache read, cache write and `total`, each with its token count. Name the period, the axis, and each filter as `filters` prints it.
4. **Say the unknowns.** Say each of these that applies, in this order:
   - a counter whose `unknown_records` is above `0`: its figure is a lower bound, and that many calls did not report it;
   - `totals.total.unknown_records` above `0`: the same for the total;
   - a row of kind `unattributed`: its `reason`, with its meaning from the reference;
   - a row of kind `absent`: that the axis had no value for those calls;
   - `run.unrecognised_shapes`, `run.skipped_ledger_lines` or any `run.not_stored` entry above `0`: that some lines were read and left out, with the counts;
   - any `coverage.left_out` entry above `0`: that many calls or lines were left out, from any day, not only the period;
   - `coverage.records` of `0`: that no call is recorded for the period, and why that may be, from the reference.
   - `totals.records` of `0` with `coverage.records` above `0`: that a filter matched no call of the period, naming each as `filters` prints it, from the reference.
5. **Bound the past.** When the period starts before `run.oldest_transcript_at`, say that a tool may have removed older session files, so earlier figures can be incomplete.
6. **Offer the fix.** For work with no task, say it can be attributed afterwards by declaring the task from that branch with `aidd telemetry task <name> [--ticket <ref>]`. A branch renamed or copied since it was declared is undeclared under its new name (unless declared by `aidd` 5.5.0 or earlier), and is declared the same way. Declare nothing yourself.

## Test

| Case | Pass |
| --- | --- |
| A report with `unknown_records` above `0` | The answer says the figure is a lower bound, and never shows `0` for it |
| A report with a `no-binding` row | The answer names the row and what it means |
| A `--days 7` report with `coverage.left_out.requestless` above `0` | The answer gives the count and says it is not bounded to the period |
| A `refused` envelope | No figure is given |
| An envelope of `version` `1` | No figure; the answer says to update the CLI so it prints version `2` |
| An envelope of `version` `3` | No figure; the answer says to update the `aidd-telemetry` plugin so it reads that version |
| Every figure in the answer | It appears in the JSON; none was computed here |
