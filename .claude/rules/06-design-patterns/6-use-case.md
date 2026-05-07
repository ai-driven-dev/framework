---
paths:
  - "src/application/use-cases/**/*.ts"
---

# Use Case

## Directory structure

- Top-level use-cases: `src/application/use-cases/*.ts` — called from commands or other top-level use-cases
- Shared sub-use-cases: `src/application/use-cases/shared/*.ts` — called only from other use-cases, never from commands directly

## Rules

- Class with `*UseCase` suffix
- Single `async execute(options: *Options): Promise<*Result>` method
- Input typed as `*Options` interface, output typed as `*Result` interface
- Throws on domain errors — caller handles via try/catch
- No plain `async function` exports — always a class
- No hardcoded technical strings — no runtime names, OS hook names, system paths
- Technical integration details belong in adapters, not use cases
- Every method (public or private) must be ≤ 20 lines — extract named private methods before reaching the limit
- Shared sub-use-cases live in `shared/` — import from there, never inline equivalent logic

## User file protection

- Guard every `fs.writeFile()` on framework files
- Check `fs.fileExists(outputPath)` AND `!manifest.isFileTracked(relativePath)`
- If both true → skip write, emit `logger.warn()`
- Never overwrite a file not owned by AIDD

## Constructor injection order

- FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter
- Prompter: domain interaction only (conflict resolution, strategy selection)
- Never use Prompter for CLI input collection in use-cases
