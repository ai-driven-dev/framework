---
paths:
  - "src/**/*.ts"
---

# Layer Responsibilities

## Use Case (`src/application/use-cases/`)

- Orchestrate domain operations end-to-end
- Return a typed result object
- Throw on errors — never catch internally
- No tool-specific logic in use-cases
- Extend capability class for tool runtime behavior
- Methods ≤ 20 lines

## Shared Use Cases (`src/application/use-cases/shared/`)

- Only called from other use-cases
- Examples: `PostInstallPipelineUseCase`
- Same rules as top-level use-cases

## Domain Model (`src/domain/models/`)

- Entities, value objects, and pure domain functions
- Validate invariants in constructor or dedicated function
- No I/O, no infrastructure dependencies

## Port (`src/domain/ports/`)

- Interface contract only — no classes, no default implementations
- Define the boundary between application and infrastructure

## Adapter (`src/infrastructure/adapters/`)

- Implement exactly one port
- Translate I/O to/from domain types
- No business logic — I/O and format translation only
