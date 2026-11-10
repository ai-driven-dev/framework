# Axis: functional

A criterion is a row of the plan's acceptance criteria tables, or one the caller gives. Trace them, phase by phase, from the files as the diff leaves them.

| The criterion | Its line |
| --- | --- |
| Met by the files as the diff leaves them, an added line or a context line | checked |
| Unmet, partial, its subject absent, or a name echoing it with no behaviour behind | unchecked, never a finding |
| Only a run could show it | unverified, unless a run recorded on this head settles it |
| Its phase's projected files all untouched | out of the diff, no box; a phase projecting no file is traced, never out of the diff |
| In the safety-net phase | traced, even untouched |
| In the phase an `implemented` plan's `## Impact` documentation row names | traced, even untouched |

No plan and no criteria: not scored. Else count met + unmet + unverified + out of the diff as the plan's whole criteria total, so a covered third never reads as a finished plan.
