# Review rubric

## Finding

A finding is traceable to current repository input, generated output, a supported host contract or an accepted fixture, keyed on a changed line, with its smallest fix. A shape nothing can reach is a limit, never a finding.

## Severity

- 🔴 critical: would harm production, its users, their data or what depends on it; must not merge as-is.
- 🟡 major: should fix.
- 🟢 minor: nit.

## Verdict

The strictest that holds.

| Verdict | When |
| --- | --- |
| `blocked` | a critical finding |
| `changes-requested` | a major finding, an unchecked criterion, or `functional` with no criterion in scope |
| `approve` | otherwise |

A criterion out of the diff or unverified at runtime neither blocks nor asks for changes. A round without `functional` is judged on its findings alone.
