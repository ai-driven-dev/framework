---
paths:
  - "src/**/*.ts"
---

# Hexagonal Architecture

## Layers

- `domain/models/` — entities, value objects
- `domain/ports/` — interfaces only, no external deps
- `domain/tools/ai/` — AI tool configs (claude, cursor, copilot, opencode)
- `domain/tools/ide/` — IDE tool configs (vscode)
- `application/` — use cases, orchestration, depends on domain only
- `infrastructure/` — adapters, I/O, framework code

## Dependency direction

- Dependencies point inward: infrastructure → application → domain
- Domain never imports from application or infrastructure
- Application imports ports, not adapters

## Ports & Adapters

- Port: interface in `domain/ports/`
- Adapter: implementation in `infrastructure/adapters/` with `Adapter` suffix
- Inject adapters via constructor, typed as port interface

## Entry point

- `cli.ts` wires commands only — no business logic
- `deps.ts` assembles the dependency graph

## Exceptions

- `CLIOutput` (Logger adapter) lives in `application/`, not `infrastructure/`
