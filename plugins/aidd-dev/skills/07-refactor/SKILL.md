---
name: 07-refactor
description: Improve code without breaking behavior across four axes - cleanup (clean-code + tech debt), performance, security, architecture. Scans and fixes, or fixes the findings of an audit report pushed in by the caller. Use when the user wants to refactor, clean up, optimize, harden, or restructure code. Do NOT use for read-only diagnosis (use 04-audit), adding tests (use 06-test), or UI redesign (use the impeccable skill).
---

# Skill: refactor

The act-side of code improvement: it changes code to make it better. Behavior-preserving for cleanup, performance, and architecture; security may change behavior on purpose to close a hole. The read-only diagnosis counterpart is `aidd-dev:04-audit` - refactor fixes, audit reports.

## Available actions

| #   | Action        | Axis         | Maps to audit pillar | Lens                                                            |
| --- | ------------- | ------------ | -------------------- | -------------------------------------------------------------- |
| 01  | `performance` | performance  | performance          | N+1, hot paths, batching, memoization, unnecessary I/O          |
| 02  | `security`    | security     | security             | OWASP, input validation, authz, secrets - harden and fix       |
| 03  | `cleanup`     | code-quality | code-quality         | clean-code: rename, extract, DRY, dead-code, complexity         |
| 04  | `architecture`| architecture | architecture         | extract layers, fix coupling, enforce boundaries                |

## Routing (run first)

This skill is run-one-OR-run-all:

- The user named an axis ("optimize this", "harden", "clean up", "restructure") -> run that ONE action.
- Unscoped ("refactor this", "improve the code") -> ask ONE question: "all applicable axes, or a specific one (cleanup / performance / security / architecture)?" Then run the chosen one, or all applicable.
- Never silently default to action 01.

## Audit handoff (push, never pull)

This skill NEVER loads or invokes the audit skill - that would make refactor depend on audit and break standalone use. Each action has two modes:

- **Standalone (default).** The action scans its axis with its own lens, then fixes. Self-contained; this is the existing behavior.
- **Audit-fed (optional).** If the caller PUSHES an `audit_report` (a path to a report under `aidd_docs/tasks/audits/`, or pasted findings), the action takes that report's findings for its axis as the fix list and skips its own scan.

The bridge is the report artifact (data), not a cross-skill reference. For a broad read-only diagnosis before fixing, the user may run `aidd-dev:04-audit` first and push its report in - a suggestion, never a dependency.

## Conventions

- Severity on any finding uses the shared 3-level scale: 🔴 critical, 🟡 warning, 🟢 minor (aligned with audit, so a pushed audit report flows in without translation).
- Behavior-preserving for cleanup, performance, and architecture: public inputs and outputs stay identical; verify via tests, type checks, or a side-by-side run. Security may alter behavior to close a vulnerability - call that out explicitly.
- Stay inside the axis. Boundaries mirror audit: dependency upgrades (CVE bumps, version maintenance) are out of scope here; test creation belongs to `aidd-dev:06-test`; UI redesign to the impeccable skill.

## Actions

- `@actions/01-performance.md`
- `@actions/02-security.md`
- `@actions/03-cleanup.md`
- `@actions/04-architecture.md`
