# Axis: functional

A criterion is a row of the plan's acceptance criteria tables, or one the caller gives. Trace them, phase by phase, from the files as the diff leaves them.

| The criterion | Its line |
| --- | --- |
| Met | checked |
| Unmet, partial, or a name echoing it with no behaviour behind | unchecked, never a finding |
| Only a run could show it | unverified, unless a run recorded on this head settles it |
| Its phase's projected files all untouched | out of the diff, no box |
| In the safety-net phase | traced, even untouched |
| In the phase an `implemented` plan's `## Impact` documentation row names | traced, even untouched |
