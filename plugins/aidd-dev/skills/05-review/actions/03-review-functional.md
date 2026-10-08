# 03 - Review Functional

Trace the diff against the plan's acceptance criteria.

## Input

The plan, its phase files, and the diff prepare resolved.

## Output

The round's criteria and score.

## Process

1. **Read.** Take the plan, or ask for the acceptance criteria.
   - None to be had: not scored.
2. **Trace.** Walk the plan's phases in order, one line per criterion.
   - A phase whose `## Architecture projection` files the diff leaves untouched: out of the diff, no box. A phase projecting no file is traced, never out of the diff.
   - Met by the files as the diff leaves them, an added line or a context line: checked.
   - Unmet, partial, its subject absent, or a name echoing it with no behaviour behind: unchecked, never a finding.
   - Its subject there, its property one no diff could ever show: checked, not-applicable.
3. **Score.** Count met + unmet + out of the diff = the plan's whole criteria total.
   - A not-applicable criterion counts as met.

## Test

| Case | Pass |
| --- | --- |
| A plan of 6 criteria, the diff touching one phase of 2 with 1 met | `1/6 met, 1 unmet, 4 out of the diff`, the untouched phases out of the diff in plan order |
| A criterion unmet, its subject absent, or a name echoing it with no behaviour behind | unchecked, naming the gap, never a finding |
| A criterion whose property no diff could show | checked, not-applicable, counted as met |
| No plan and no criteria given | not scored, and no criteria |
| A second round over the same plan | every box follows the current diff, none carried from the earlier round |
