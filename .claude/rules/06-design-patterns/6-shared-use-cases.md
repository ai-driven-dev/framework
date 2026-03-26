---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Shared Use Cases

## Location

Shared use-cases live in `src/application/use-cases/shared/`.

## Access rules

- Never called from commands directly — only from other use-cases
- Commands wire adapters and call top-level use-cases only

## Interface contract

- Each shared use-case is a class with a single `execute()` method
- Input typed as `*Options` interface, output typed (void or a specific result)
- Constructor injection order: FileSystem → ManifestRepository → Hasher → Git

## PostInstallPipelineUseCase

The canonical post-write sequence after any install or update:

1. `MemoryScriptUseCase.execute(...)` — write/update the memory bank script
2. `manifestRepo.save(manifest)` — persist the updated manifest
3. `CatalogUseCase.execute(...)` — regenerate the CATALOG.md
4. `GitignoreUseCase.execute(...)` — ensure `.aidd/cache/` is gitignored

No use-case outside `PostInstallPipelineUseCase` should call `MemoryScriptUseCase`, `CatalogUseCase`, or `GitignoreUseCase` together as a group.

### Exception — InitUseCase

`InitUseCase` calls `manifestRepo.save` + `CatalogUseCase` + `GitignoreUseCase` directly (3 of 4 steps).
`MemoryScriptUseCase` is intentionally absent: no tools are installed during `init`, so there is no memory bank content to write.
This exception is documented inline in `init-use-case.ts` and must not be "fixed" by adding a `skipMemoryScript` option to the pipeline.

## SetupStateDetector

Encapsulates the logic to determine which setup phase a project is in.

- `detect(projectRoot): Promise<SetupState>` returns one of: `needs-init`, `needs-adopt`, `needs-install`, `needs-update`, `up-to-date`
- Used by `SetupUseCase.execute()` to dispatch to the correct handler
- The free function `detectSetupState` has been removed — use `SetupStateDetector` directly
