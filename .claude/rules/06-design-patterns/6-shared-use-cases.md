---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Shared Use Cases

## Rules

- Live in `src/application/use-cases/shared/`
- Never called from commands — only from other use-cases
- Use-cases: class with single `execute()`, typed `*Options` input, typed output
- Services (e.g. `SetupStateService`): may expose named methods (`detect()`) instead of `execute()`
- Constructor injection order: FileSystem → ManifestRepository → Hasher → Git

## PostInstallPipelineUseCase

- Canonical post-write sequence: MemoryScriptUseCase → manifestRepo.save → CatalogUseCase → GitignoreUseCase
- Any use-case writing files and updating manifest must delegate here, never replicate
- `InitUseCase` exception: skips step 1 (no tools installed yet); documented inline in `init-use-case.ts`

## SetupStateService

- `detect(projectRoot)` returns one of: `needs-init`, `needs-adopt`, `needs-install`, `needs-update`, `up-to-date`
- Used by `SetupUseCase.execute()` to dispatch
- `detectSetupState` free function has been removed — use `SetupStateService` directly
