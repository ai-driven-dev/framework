# Axis: functional

Trace the diff against the plan's criteria. No plan: ask for the criteria; none to be had: not scored.

Walk the plan's phases in order, one line per criterion, from the files as the diff leaves them:

| The criterion | Its line |
| --- | --- |
| Its phase's `## Architecture projection` files all untouched | out of the diff, no box |
| Its phase projects no file | traced, never out of the diff |
| Met, by an added line or a context line | checked |
| Unmet, partial, its subject absent, or a name echoing it with no behaviour behind | unchecked, never a finding |
| Its subject there, its outcome one only a run could show, what a screen displays, a timing, an outside system's answer | unverified, never checked from the code |
| A run recorded beside the plan on the reviewed head | passing: checked, citing the record; failing: unchecked; on another head: unverified |

Then what the plan declared:

- Its status is `implemented` and its `## Impact` documentation row names a phase: that phase is traced, never out of the diff. Any other status, or a row saying `none`: nothing more.
- A test its safety-net phase locked, modified or deleted by the diff: a major finding, kind `regression`.
- The safety net's status: its phase's criteria, from a run recorded on the reviewed head, else unverified.

Count met + unmet + unverified + out of the diff = the plan's whole criteria total.
