---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Use Case

- Class with `*UseCase` suffix
- Single `async execute(options)` method
- Returns typed result
- Throws on domain errors — caller handles via try/catch
- No plain `async function` exports — always a class
- No hardcoded technical strings — no runtime names, OS hook names, system paths
- Technical integration details belong in adapters, not use cases
