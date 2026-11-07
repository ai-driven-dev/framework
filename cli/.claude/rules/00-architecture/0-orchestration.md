---
description: Apply to a use case spanning several areas; one dependency per area crossed, five at most.
paths:
  - "src/contexts/*/application/**/*.ts"
---

# Orchestration

- Depend on an area's entry point.
- One dependency per area crossed.
- Five dependencies at most, injected or instantiated (`new XUseCase(...)`), counted by `orchestrator-deps.arch.test.ts` with its per-file counts.
- Keep an area's steps inside it.
- A second collaborator from one area means its entry point is missing.
- Baseline an oversize orchestrator with its count and reason.
