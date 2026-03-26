---
name: use-case-refactoring-master
description: Master plan — full application layer refactoring
---

# Instruction: Application Layer Refactoring — Master Plan

## Feature

- **Summary**: Refactor the entire application layer (use-cases, domain models, tests, rules, docs) to eliminate technical debt: methods > 20 lines, duplicated post-install pipeline, hardcoded discriminant strings, anemic models, and inconsistent test pyramid.
- **Stack**: `TypeScript ESM, Node.js >= 24, Vitest, Biome`
- **Branch name**: `refactor/application-layer`
- **Parent Plan**: `none`
- **Sequence**: `master`
- **Confidence**: 9/10
- **Time to implement**: 6–8 sessions

## Child Plans

| # | File | Goal |
|---|------|------|
| 0 | @aidd_docs/tasks/2026_03/2026_03_24-use-case-refactoring-part-0.md | Safety net — E2E gaps + test pyramid rules |
| 1 | @aidd_docs/tasks/2026_03/2026_03_24-use-case-refactoring-part-1.md | Domain enrichment — value objects + discriminant types |
| 2 | @aidd_docs/tasks/2026_03/2026_03_24-use-case-refactoring-part-2.md | Shared sub-use-cases — PostInstallPipeline, SetupStateDetector |
| 3 | @aidd_docs/tasks/2026_03/2026_03_24-use-case-refactoring-part-3.md | Use case cleanup — all 7 use cases, one commit per use case |
| 4 | @aidd_docs/tasks/2026_03/2026_03_24-use-case-refactoring-part-4.md | Test pyramid restructuring |
| 5 | @aidd_docs/tasks/2026_03/2026_03_24-use-case-refactoring-part-5.md | Rules + docs update |

## Dependency graph

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
(safety)    (domain)    (shared)    (cleanup)   (tests)     (docs)
```

Each phase must leave the codebase green (all E2E pass) before the next starts.

## Invariants across all phases

- All E2E tests must pass at every merge
- Public `*Options` and `*Result` interfaces may evolve only if justified and documented
- No `--no-verify` commits
- Each new type/class/use-case must have a corresponding test
- No barrel files (`index.ts`)
- Constructor injection order: FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter

## Key debt identified

| Problem | Location | Phase |
|---------|----------|-------|
| `executeInternal()` 166 lines | update-use-case.ts | 3 |
| `handleInit()` 106 lines | setup-use-case.ts | 3 |
| `propagateModified()` ~89 lines | sync-use-case.ts | 3 |
| Post-install pipeline duplicated | install + update (missing in adopt/uninstall) | 2 |
| `"added"/"removed"/"changed"/"unchanged"` hardcoded | update-use-case.ts | 1 |
| `"overwrite"/"skip"/"backup"` hardcoded | update-use-case.ts, restore-use-case.ts | 1 |
| `UpdateScope` `"all"/"docs"/"tool:"` strings | update-use-case.ts | 1 |
| `SetupUseCase` instantiates 4 other use-cases | setup-use-case.ts | 2–3 |
| EXCLUDED_FILES hardcoded in sync | sync-use-case.ts | 1 |
| 5 rules missing | .claude/rules/ | 5 |
| E2E gaps: adopt, auth, lifecycle | tests/e2e/ | 0 |

## Confidence assessment

- ✅ E2E coverage is solid (13/13 commands) — strong safety net once gaps are filled
- ✅ Architecture is already hexagonal — no layer inversions to fix
- ✅ Ports are clean — no logic leaks into adapters
- ✅ Each phase is independently mergeable
- ❌ Phase 3 touches 7 use-cases in one PR — risk of large diff, mitigated by one-commit-per-use-case rule
- ❌ `SetupUseCase` orchestration refactoring is the most complex change — requires careful dependency injection review
