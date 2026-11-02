# Review rubric

## Finding

A defect tied to the diff, reachable from a real input, caller or contract, with its smallest fix. What nothing can reach is a limit, never a finding.

## Severity

| Severity | When |
| --- | --- |
| 🔴 critical | would harm production, its users, their data or what depends on it |
| 🟡 major | a user or a caller will hit it, or the next change will |
| 🟢 minor | nothing breaks if it stays |

## Verdict

The strictest that holds.

| Verdict | When |
| --- | --- |
| `blocked` | a critical finding |
| `changes-requested` | a major finding, an unchecked criterion, or `functional` with no criterion met |
| `approve` | otherwise |
