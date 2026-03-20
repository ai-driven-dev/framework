---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Use Case

- Class with `*UseCase` suffix
- Single `async execute(options: *Options): Promise<*Result>` method
- Input typed as `*Options` interface, output typed as `*Result` interface
- Throws on domain errors — caller handles via try/catch
- No plain `async function` exports — always a class
- No hardcoded technical strings — no runtime names, OS hook names, system paths
- Technical integration details belong in adapters, not use cases

## Constructor injection order

FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter
