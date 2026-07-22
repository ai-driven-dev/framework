---
paths:
  - "src/**/*.ts"
---

# File Naming

## Source files

- `kebab-case.ts` for all source files
- Adapter files: `*-adapter.ts`
- Use-case files: `*-use-case.ts`
- Port files: match the interface name (e.g. `file-system.ts` for `FileSystem`)

## Test files

- `*.unit.test.ts` — domain models, pure functions
- `*.integration.test.ts` — use-cases, adapters
- `*.e2e.test.ts` — full CLI invocation
