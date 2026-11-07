---
description: Apply to a use case spanning several areas; one dependency per area crossed, four at most.
paths:
  - "src/contexts/*/application/**/*.ts"
---

# Orchestration

- Depend on an area's entry point.
- One dependency per area crossed.
- Four other use cases at most.
- `orchestrator-deps.arch.test.ts` counts injections and `new XUseCase(...)`, deduped by class.
- Every constructor is also capped at five parameters (`0-code-size.md`); for a use case the four above is stricter and applies.
- Keep an area's steps inside it.
- A second collaborator from one area means its entry point is missing.
- Baseline an oversize orchestrator with its count and reason.
