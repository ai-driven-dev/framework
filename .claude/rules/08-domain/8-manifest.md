---
paths:
  - "src/domain/models/manifest.ts"
  - "src/application/use-cases/**/*.ts"
---

# Manifest

## Aggregate root

- Tracks every installed framework file with its MD5 hash
- Persisted at `.aidd/manifest.json`
- Single source of truth for installed state

## Write guard

- Before writing any framework file: check `fs.fileExists(path)` AND `!manifest.isFileTracked(relativePath)`
- If file exists but is untracked → skip write, emit `logger.warn()`, never add to manifest
- Never overwrite a user-owned file

## Saving

- Always save via `PostInstallPipelineUseCase` (or directly for `InitUseCase` which skips step 1)
- Never call `manifestRepo.save()` in isolation outside the pipeline

## Merge file tracking

- Merge config files tracked in `ToolEntry.mergeFiles` (not in `files`)
- Per-entry hashes via `extractMergeEntries(content, sectionKey, hasher)`
- Framework content may be JSONC — `extractMergeEntries` strips comments
- `isFileTracked()` checks both `files` and `mergeFiles`
- Uninstall/clean must delete merge files alongside regular files
