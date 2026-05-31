---
name: review-code
description: Code review report template for a diff
argument-hint: N/A
---

# Code Review: {{feature}}

{{one_line_summary}}

- **Verdict**: {{approve | changes-requested | blocked}}
- **Diff scope**: `{{base}}...{{head}}`
- **Date**: {{yyyy_mm_dd}}
- **Findings**: {{n_critical}} critical, {{n_warning}} warning, {{n_minor}} minor

Verdict: `approve` = no critical findings, ship it; `changes-requested` = warnings or a fixable critical to address first; `blocked` = a critical that must not merge.

## Expected changes

What the diff was meant to deliver (from the ticket or plan). Tick what the diff actually does.

- [ ] {{expected_change_1}}
- [ ] {{expected_change_2}}

## Findings

One row per issue, on the CHANGED lines only (this is a diff review, not a codebase audit). Every row cites a `file:line`. Sort by severity. Read-only: describe the fix, do not patch it - hand fixes off to `aidd-dev:07:refactor`.

Severity: 🔴 critical (must not merge as-is), 🟡 warning (should fix), 🟢 minor (nit).
Category (one of): `standards`, `architecture`, `code-health`, `security`, `error-handling`, `performance`, `frontend`, `backend`.

| Sev | Category    | Location              | Issue                                | Suggested fix                        |
| --- | ----------- | --------------------- | ------------------------------------ | ------------------------------------ |
| 🔴  | security    | `src/api/user.ts:30`  | Request body used without validation | Validate with the project schema lib |
| 🟡  | code-health | `LivePreview.tsx:43`  | `user` recomputed on every render    | Memoize with `useMemo`               |

## Coverage

Dimensions examined on the diff (a dimension with no finding is still listed here as scanned; one not applicable to this diff is marked n/a).

- **Scanned**: {{dimensions examined, comma-separated}}
- **Not applicable**: {{dimensions n/a for this diff, or "none"}}

## Follow-up

- **Top fixes** (ranked, hand off to `aidd-dev:07:refactor`): {{top_fixes}}
- **Notes**: {{additional_notes}}
