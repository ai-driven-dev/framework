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

## User file protection

Any `fs.writeFile()` on a framework-distributed file must be guarded:
- Check `fs.fileExists(outputPath)` AND `!manifest.isFileTracked(relativePath)`
- If both true → skip write, emit `logger.warn()`, do NOT add to manifest
- Never overwrite a file that exists on disk but is not owned by AIDD

## Constructor injection order

FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter
