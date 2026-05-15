---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Shared Use Cases

## Rules

- Live in `src/application/use-cases/shared/`
- Never called from commands — only from other use-cases
- Use-cases: class with single `execute()`, typed `*Options` input, typed output

## PostInstallPipelineUseCase

- Pipeline steps: see `0-post-install-pipeline.md`
- Any use-case writing files and updating manifest must delegate here, never replicate
