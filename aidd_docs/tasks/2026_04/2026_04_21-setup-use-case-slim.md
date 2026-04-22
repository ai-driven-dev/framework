---
name: setup-use-case-slim
description: Slim SetupUseCase from 491 lines to < 200 by delegating to existing use-cases
---

# Instruction: SetupUseCase Slim-Down

## Feature

- **Summary**: `SetupUseCase` at 491 lines duplicates logic from `InstallUseCase`, `AdoptUseCase`, and `UpdateUseCase`. Each `handleXxx` method re-orchestrates what those use-cases already do. The goal is to make `SetupUseCase` a pure dispatcher: detect state → resolve framework → delegate to the right use-case.
- **Stack**: TypeScript, Node.js, Vitest
- **Branch name**: `refactor/setup-use-case-slim`
- **Parent**: `feat/124-vscode-standalone-tool-part-2` (merge base)
- **Target**: < 200 lines

## Context

Current structure (`src/application/use-cases/setup-use-case.ts`, 491 lines):

```
handleInit(options)     → 37 lines → duplicates InitUseCase
handleAdopt(options)    → 54 lines → duplicates AdoptUseCase
handleInstall(options)  → 51 lines → duplicates InstallUseCase
handleUpdate(options)   → 64 lines → duplicates UpdateUseCase
handleUpToDate(options) → 19 lines
+ 10 private helpers (resolveDocsDir, resolveFrameworkSource, resolveRelease, validateAdoptNonInteractive, formatSignalDiagnostic, runInit, runAdopt, ...)
```

## Phase 1 — Audit private methods

### Checklist

- [ ] Read all `handleXxx` methods and map what each does vs what the target use-case already does
- [ ] Identify helpers that are purely wiring (`resolveFrameworkSource`, `resolveRelease`) vs helpers that contain business logic that belongs in a use-case
- [ ] For each helper: keep in setup (if pure wiring), move to use-case (if business logic), or move to domain (if pure function)

## Phase 2 — Delegate to use-cases

### Checklist

- [ ] `handleInit` → call `InitUseCase.execute(...)` directly; remove duplicated init logic from setup
- [ ] `handleAdopt` → call `AdoptUseCase.execute(...)` directly; remove duplicated adopt logic
- [ ] `handleInstall` → call `InstallUseCase.execute(...)` directly; this already happens partially but check for any extra logic not in the use-case
- [ ] `handleUpdate` → call `UpdateUseCase.execute(...)` directly; remove duplicated update logic
- [ ] `handleUpToDate` → keep, it's already minimal (prompt + early return)

## Phase 3 — Simplify constructor

### Checklist

- [ ] After delegation, check if all injected deps are still needed in `SetupUseCase` itself
- [ ] Remove deps that are only passed through to delegated use-cases (inject use-cases directly instead)
- [ ] Target: constructor takes `SetupStateDetector` + the 4 use-cases + `Prompter`

## Validation

- `pnpm typecheck && pnpm test` after each phase
- `pnpm knip` — no dead exports
- `wc -l src/application/use-cases/setup-use-case.ts` → < 200

## Risk

- Medium — `SetupUseCase` coordinates framework resolution for all states; ensure each delegated use-case still receives the right `frameworkPath`/`version`
- `handleAdopt` has non-interactive validation logic and diagnostic formatting — check if these belong in `AdoptUseCase` or command layer before moving
