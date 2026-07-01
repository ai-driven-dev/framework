# Review rubric

Shared definitions for the three review axes. The actions and the report template draw from here, so the scales live in one place.

## Severity

- 🔴 critical: must not merge as-is.
- 🟡 warning: should fix.
- 🟢 minor: nit.

## Verdict

One overall verdict, the strictest across the axes run:

- `approve`: no critical finding, and no criterion left unchecked and tagged `fix`, ship it. A `not-applicable` or `fixed` criterion does not block.
- `changes-requested`: warnings, a fixable critical, or any unchecked criterion tagged `fix`.
- `blocked`: a critical that must not merge, or an unchecked critical criterion.

An unchecked criterion tagged `fix` is a functional finding: it appears as a `functional` row in `Findings` (so it counts) and cannot yield `approve`. A `not-applicable` criterion is neither a finding nor a blocker.

## Code categories

`standards`, `architecture`, `code-health`, `security`, `error-handling`, `performance`, `frontend`, `backend`.

## Relevancy lenses

- `fit`: serves the real need, not only the literal criteria.
- `conform`: the project's declared rules and the surrounding conventions.
- `rot`: duplication, over-engineering, incoherence (naming, docs versus code).
