---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Post-Install Pipeline

## Rules

- Any use-case writing files and updating manifest → delegate to `PostInstallPipelineUseCase`
- Never call `CatalogUseCase`, `GitignoreUseCase` outside the pipeline
- Steps: manifestRepo.save → CatalogUseCase → GitignoreUseCase

## InitUseCase exception

- Calls pipeline directly (no skipped steps)
- Documented inline in `init-use-case.ts`
