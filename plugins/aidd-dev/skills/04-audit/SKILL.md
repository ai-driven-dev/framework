---
name: 04-audit
description: Read-only codebase audit across seven quality pillars (code-quality, architecture, security, dependencies, performance, tests, ui) into one ranked findings report. Use to assess or health-check a codebase, or one pillar of it. Do NOT use to fix the findings, to review a single change, or to validate that a feature works.
argument-hint: code-quality | architecture | security | dependencies | performance | tests | ui
model: opus
---

# Skill: audit

Diagnose a codebase against quality pillars and emit one ranked findings report. Read-only: it identifies and ranks problems, never changes code.

## Actions

| #   | Action         | Pillar       | Lens                                                                 |
| --- | -------------- | ------------ | -------------------------------------------------------------------- |
| 01  | `code-quality` | code-quality | Clean code (naming, SOLID, DRY, readability, smells) and tech debt (dead code, complexity, file/function size, error handling) |
| 02  | `architecture` | architecture | Conformance to C4 / ADRs, coupling, boundaries, layering             |
| 03  | `security`     | security     | OWASP risks, authz, input validation, secrets in code                |
| 04  | `dependencies` | dependencies | CVEs, licenses, outdated and unused deps, supply chain               |
| 05  | `performance`  | performance  | N+1 queries, hot paths, bundle size, heavy operations                |
| 06  | `tests`        | tests        | Critical-path coverage, flakiness, test pyramid balance              |
| 07  | `ui`           | ui           | Loading/error/empty states, visual hierarchy, design-system drift, responsive, a11y |

Run the one pillar named, or offer all seven when the request is unscoped.

## Transversal rules

- Read-only: diagnose and rank, never edit code.
- Scope: run the one named pillar, or for an unscoped request ask once "all seven pillars, or one?" before running. Never silently default to one pillar, never blind-run all without offering the choice.
- One report, one writer. A single-pillar run writes `aidd_docs/tasks/audits/<yyyy>_<mm>_<pillar>.md`. A full run collects every pillar's findings and writes one merged `aidd_docs/tasks/audits/<yyyy>_<mm>_full.md`: a single Findings table (each row's category is its pillar, severity-first), one ranked Top-actions list, and one Coverage section covering all seven pillars.
- Unscannable pillar: skip it, record it under `Coverage > Skipped` with the reason, and never invent findings for it.
- Every finding row carries a severity, its pillar, a concrete `file:line`, the issue, a suggested fix, and an effort.

## Assets

- `@assets/audit-template.md`: the report structure both run modes fill.
