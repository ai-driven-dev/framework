---
name: 04-audit
description: Read-only codebase audit across quality pillars (code-quality, architecture, security, dependencies, performance, tests, ui). Diagnoses and reports findings; never edits code. Use when the user wants to assess, audit, or health-check a codebase or one dimension of it, then hands off to the act-skills (refactor, test, impeccable) to fix. Do NOT use for fixing the findings (hand off to refactor/test/impeccable), per-PR code review (use 05-review), or validating that a feature works (use 03-assert).
argument-hint: code-quality | architecture | security | dependencies | performance | tests | ui
model: opus
---

# Skill: audit

Diagnoses a codebase against quality pillars and emits a structured findings report. This skill is **read-only**: it identifies and ranks problems, it never changes code. Each finding hands off to the relevant act-skill when a fix is wanted.

## Available actions

| #   | Action         | Pillar       | Lens                                                                 |
| --- | -------------- | ------------ | -------------------------------------------------------------------- |
| 01  | `code-quality` | code-quality | Clean code (naming, SOLID, DRY, readability, smells) + tech debt (dead code, complexity, file/function size, error handling) |
| 02  | `architecture` | architecture | Conformance to C4 / ADRs, coupling, boundaries, layering             |
| 03  | `security`     | security     | OWASP risks, authz, input validation, secrets in code                |
| 04  | `dependencies` | dependencies | CVEs, licenses, outdated and unused deps, supply chain               |
| 05  | `performance`  | performance  | N+1 queries, hot paths, bundle size, heavy operations                |
| 06  | `tests`        | tests        | Critical-path coverage, flakiness, test pyramid balance              |
| 07  | `ui`           | ui           | Loading/error/empty states, visual hierarchy, design-system drift, responsive, a11y |

## Routing (run first)

This skill is run-one-OR-run-all:

- The user named a pillar ("audit security", "audit the deps", "perf audit") -> run that ONE action.
- The user asked for a full or unscoped audit ("audit the codebase", "/audit", "health check") -> ask ONE question: "Full audit (all 7 pillars), or a specific pillar?" Then run all applicable pillars, or the chosen one.
- Never silently default to action 01. Never run a blind all without offering the choice first.

When running all, skip a pillar whose method cannot run in this environment (e.g. no profiler for performance, no lockfile scanner for dependencies) and record it under the report's `Coverage > Skipped` with the reason. Never invent findings for an unscannable pillar.

## Output contract

The report uses the shared template `@assets/audit-template.md`. There is ALWAYS exactly one report file and exactly one writer of it - never one file per pillar in a full run.

**Single-pillar run.** Run the one pillar action; it writes its own report at `aidd_docs/tasks/audits/<yyyy>_<mm>_<pillar>.md`.

**Full run.** Run each applicable pillar action to COLLECT its findings (the pillars do not each write a file in this mode), then write ONE merged report at `aidd_docs/tasks/audits/<yyyy>_<mm>_full.md`:
- one template header,
- the union of every pillar's finding rows in a single Findings table (`Category` = the pillar per row), sorted severity-first across all pillars,
- one ranked Top-actions list spanning all pillars,
- one Coverage section listing all 7 pillars as scanned or skipped (with reason).

Every finding row: severity + pillar + concrete `file:line` + issue + suggested fix + effort. Read-only in both modes: emit the report and stop; never edit code.

## Actions

- `@actions/01-code-quality.md`
- `@actions/02-architecture.md`
- `@actions/03-security.md`
- `@actions/04-dependencies.md`
- `@actions/05-performance.md`
- `@actions/06-tests.md`
- `@actions/07-ui.md`
