# Review rubric

Shared definitions for the three review axes. The actions and the report template draw from here, so the scales live in one place.

## Severity

- 🔴 critical: must not merge as-is.
- 🟡 warning: should fix.
- 🟢 minor: nit.

## Verdict

One overall verdict, the strictest across the axes run:

- `approve`: no critical finding, ship it.
- `changes-requested`: warnings, or a fixable critical to address first.
- `blocked`: a critical that must not merge.

## Code categories

`standards`, `architecture`, `code-health`, `security`, `error-handling`, `performance`, `frontend`, `backend`.

## Relevancy lenses

- `fit`: serves the real need, not only the literal criteria.
- `conform`: the project's declared rules and the surrounding conventions.
- `rot`: duplication, over-engineering, incoherence (naming, docs versus code).
