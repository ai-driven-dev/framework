---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---

# TypeScript

## Imports

- Relative imports only, with `.js` extension (ESM)
- Use `import type` for type-only imports

## Naming

- `camelCase` — variables, functions, methods
- `PascalCase` — classes, interfaces, types
- `CONSTANT_CASE` — module-level constants
- `_param` — only when interface contract forces unused method param
- `readonly _field` — constructor-injected dep not used in body

## Async

- `async/await` only, no `.then()` chains
- All I/O operations are async

## Types

- No `any` — use explicit types or generics
- Prefer interfaces for contracts, types for unions/aliases
- `readonly` on arrays and maps that must not mutate
