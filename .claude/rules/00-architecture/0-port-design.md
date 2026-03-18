---
paths:
  - "src/domain/ports/**/*.ts"
  - "src/infrastructure/adapters/**/*.ts"
---

# Port Design

## Intent over mechanism

- Method names describe what the caller wants, not how it's done
- Bad: `resolveHooksDir()` — exposes internal mechanism
- Good: `installPreCommitDelegate()` — expresses intent

## Hide adapter internals

- Implementation details (hook names, runtime strings, system paths) stay in the adapter
- Port signature must not leak the adapter's internal structure
- Callers should not need to know how the adapter works

## Naming

- Use domain vocabulary, not technical vocabulary
- Avoid words like: `resolve`, `parse`, `build`, `compute` — prefer: `install`, `register`, `sync`
