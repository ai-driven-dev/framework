# Review rubric

The scales the axes share, so a finding reads the same whoever wrote it.

## Severity

- 🔴 critical: would harm production, its users, their data or what depends on it; must not merge as-is.
- 🟡 major: should fix.
- 🟢 minor: nit.

## Verdict

One overall verdict, the strictest across the axes run.

| Verdict | When |
| --- | --- |
| `approve` | no finding above minor, and, where functional ran, at least one criterion in scope and none unchecked |
| `changes-requested` | a major, an unchecked criterion, or no criterion in scope |
| `blocked` | a critical finding |

| Case | Counts as |
| --- | --- |
| A criterion out of the diff | neither unchecked nor blocking |
| A round without functional | a verdict from its findings alone |
