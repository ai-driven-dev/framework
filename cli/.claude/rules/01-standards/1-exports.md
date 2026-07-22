---
paths:
  - "src/**/*.ts"
---

# Exports

- Named exports only — no `export default`
- No barrel files (`index.ts`) — import from the source file directly
- Use cases: export the class, never a plain `async function`
- Domain helpers: named function exports at module level
