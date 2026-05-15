← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 07 - refactor

Optimizes code for performance and hardens it against security
vulnerabilities. Covers two axes: targeted performance fixes and OWASP-
aligned security remediation.

## When to use

- A profile or measurement points to a hot path that needs optimization.
- A security review surfaces vulnerabilities to remediate (injection,
  auth, secrets, dependency CVEs, etc.).
- An audit from [04-audit](../04-audit/README.md) flagged debt items
  worth refactoring now.

## When NOT to use

- You don't yet know what's slow or vulnerable → run
  [04-audit](../04-audit/README.md) first.
- The task is a functional bug fix → use
  [08-debug](../08-debug/README.md).
- You want to add new behavior, not refactor existing behavior → use
  [02-implement](../02-implement/README.md).

## How to invoke

```
Use skill aidd-dev:07:refactor
```

The skill exposes 2 actions:

1. `performance` - locate hot paths, propose changes, apply the fix,
   confirm the gain.
2. `security` - locate vulnerabilities against OWASP guidance, apply the
   fix, document the rationale.

## Outputs

- Refactor commits scoped to the optimization or vulnerability.
- A before / after note for the performance variant.
- A security advisory entry for the vulnerability variant (location,
  CWE class, fix description).

## Prerequisites

- A reproducible benchmark or profile for the performance variant.
- A known vulnerability or threat model for the security variant.
- Tests in place so the refactor is verifiable (or scheduled to be added
  via [06-test](../06-test/README.md)).

## Technical details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/) for the two
refactor contracts. The security action references OWASP categories
explicitly.
