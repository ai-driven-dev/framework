---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Post-Install Pipeline

## Canonical sequence

After any use-case that writes framework files to disk and updates the manifest, the following steps must run in this exact order:

1. `MemoryScriptUseCase.execute(...)` — write/update the memory bank script for all installed tools
2. `manifestRepo.save(manifest)` — persist the updated manifest to `.aidd/manifest.json`
3. `CatalogUseCase.execute(...)` — regenerate `CATALOG.md`
4. `GitignoreUseCase.execute(...)` — ensure `.aidd/cache/` is present in `.gitignore`

## Rule: use the pipeline, never replicate it

This sequence is encapsulated in `PostInstallPipelineUseCase` (`src/application/use-cases/shared/post-install-pipeline-use-case.ts`).

- No use-case other than `PostInstallPipelineUseCase` should call `MemoryScriptUseCase`, `CatalogUseCase`, and `GitignoreUseCase` together as a group.
- Any new use-case that writes files to disk and updates the manifest must delegate to `PostInstallPipelineUseCase`.

## Exception — InitUseCase

`InitUseCase` calls `manifestRepo.save` + `CatalogUseCase` + `GitignoreUseCase` directly (steps 2–4 only).

Reason: at `init` time no tools are installed yet, so there is no memory bank content to write — `MemoryScriptUseCase` (step 1) is intentionally absent.

This exception is documented inline in `init-use-case.ts`. It must not be "fixed" by adding a `skipMemoryScript` flag to the pipeline — the pipeline assumes at least one tool is present.
