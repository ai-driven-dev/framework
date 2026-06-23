---
name: review-relevancy
description: Relevancy review report template for a diff
argument-hint: N/A
---

# Relevancy Review: {{feature}}

{{one_line_summary}}

- **Verdict**: {{approve | changes-requested | blocked}}
- **Diff scope**: `{{base}}...{{head}}`
- **Need**: {{the objective the change serves}}
- **Date**: {{yyyy_mm_dd}}
- **Findings**: {{n_critical}} critical, {{n_warning}} warning, {{n_minor}} minor

Verdict: `approve` = the change belongs as built; `changes-requested` = misfits to address first; `blocked` = a misfit that must not merge.

## Findings

One row per misfit. Every row ties to evidence, never an opinion: a declared rule, a duplication site, an over-engineering smell, or a named gap between the change and the need. Read-only: describe the fix, do not patch it.

Severity: 🔴 critical (must not merge as-is), 🟡 warning (should fix), 🟢 minor (nit).
Lens (one of): `fit` (serves the real need), `conform` (declared rules and conventions), `rot` (duplication, over-engineering, incoherence).

| Sev | Lens    | Location / rule       | Misfit                                       | Suggested fix                       |
| --- | ------- | --------------------- | -------------------------------------------- | ----------------------------------- |
| 🔴  | fit     | `src/cart.ts:6`       | Formats USD; the need is EUR for FR users    | Reuse `formatEUR`; correct the need |
| 🟡  | rot     | `src/cart.ts:6`       | Reinvents existing `formatEUR` (money.ts)    | Delegate to `formatEUR`             |
| 🟢  | conform | `naming-rule.md`      | `getData` violates the verb-noun rule        | Rename per the rule                 |

## Coverage

- **Scanned**: {{fit, conform, rot: whichever applied}}
- **Sources**: {{the need source, the rule files discovered, or "none found"}}

## Follow-up

- **Top fixes** (ranked, hand off per complexity to `aidd-dev:07-refactor`, `aidd-dev:02-implement`, or `aidd-dev:08-debug`): {{top_fixes}}
- **Notes**: {{additional_notes}}
