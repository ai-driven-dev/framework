---
paths:
  - "src/**/*.ts"
---

# Layer Responsibilities

## Command (`src/application/commands/`)

- Wire only: create deps → call use-case → display result
- Validate CLI flags before try/catch (`output.error()` + `process.exit(1)`)
- Validate domain input inside try/catch (domain throws, `output.exit()` catches)
- No business logic, no helper functions

## Use Case (`src/application/use-cases/`)

- Orchestrate domain operations end-to-end
- Return a typed result object
- Throw on invalid input or domain errors — never catch internally
- No tool-specific logic — tool names (`opencode`, `cursor`, etc.), tool file names, or per-tool decisions must not appear here
- If a tool needs runtime behavior (e.g. dynamic output path), extend the relevant domain interface (`ConfigHandler`, etc.) and implement it in the tool's domain file
- Methods must be ≤ 20 lines — extract named private methods before reaching the limit

## Shared Use Cases (`src/application/use-cases/shared/`)

- Orchestration helpers called only by other use-cases, never by commands
- Examples: `PostInstallPipelineUseCase`, `SetupStateDetector`
- Same rules as top-level use-cases (class, single `execute()`, typed input/output, throws on errors)

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
