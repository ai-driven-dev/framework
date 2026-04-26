---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Post-Install Pipeline

## Rules

- Any use-case writing files and updating manifest → delegate to `PostInstallPipelineUseCase`
- Never call `MemoryScriptUseCase`, `CatalogUseCase`, `GitignoreUseCase` as a group outside the pipeline
- Steps: MemoryScriptUseCase → manifestRepo.save → CatalogUseCase → GitignoreUseCase

## InitUseCase exception

- Skips step 1 (MemoryScriptUseCase) — no tools installed yet at `init` time
- Documented inline in `init-use-case.ts`; do not add a `skipMemoryScript` flag to the pipeline
