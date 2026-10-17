---
status: done
---

# Phase 1: The CLI writes the stamp and reads only the command's declaration

## Architecture projection

```txt
cli/src/contexts/telemetry/
├── domain/branch-binding.ts                                   ✏️ parseBranchConfig keeps only declared branches
├── domain/report/attribution.ts                               ✏️ a snapshot with no declared_at attributes nothing
├── infrastructure/git-branch-binding-source-adapter.ts        ✏️ reads aiddDeclaredFor
├── infrastructure/declaration/git-branch-binding-store-adapter.ts ✏️ writes aiddDeclaredFor before aiddDeclaredAt
└── infrastructure/forget/repository-declarations-adapter.ts   ✏️ removes aiddDeclaredFor
cli/tests/                                                     ✏️ unit, integration, e2e (contract acceptance 1-4, 6)
```

## Tasks

1. Red first: e2e copy, hand-set, rename then redeclare, legacy; unit parse cases; attribution null snapshot; store and forget adapters. Record red in `evidence.md`.
2. Code to green. One mutation per guard, recorded.
