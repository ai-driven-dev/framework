---
id: 024
milestone: M2
title: "Implement FrameworkLoaderAdapter, HasherAdapter, and FileSystemAdapter"
stories: [US-001]
points: 3
blockedBy: [023]
---

# 024: Implement FrameworkLoaderAdapter, HasherAdapter, and FileSystemAdapter

## Context
Three infrastructure adapters are needed: FrameworkLoaderAdapter (parses framework.json and loads content files), HasherAdapter (MD5 hashing), and FileSystemAdapter (file I/O operations). These are used by all use cases.

## Scope
Implement the three adapters as implementations of their respective domain ports.

## Acceptance Criteria
- [ ] **FrameworkLoaderAdapter** implements FrameworkLoader port:
  - `loadFromDirectory(path)` reads `framework.json`, parses it into FrameworkDescriptor
  - Reads all content files from directories declared in the descriptor
  - Returns `{descriptor, contentFiles: Map<string, string>}` where keys are relative paths
- [ ] **HasherAdapter** implements Hasher port:
  - `hash(content: string): FileHash` using `node:crypto` MD5 (ADR-003)
  - Returns 32-char lowercase hex string
- [ ] **FileSystemAdapter** implements FileSystem port:
  - `writeFile(path, content)` creates parent dirs if needed
  - `deleteFile(path)` removes file, no error if missing
  - `createDirectory(path)` recursive mkdir
  - `deleteEmptyDirectories(path)` walks up removing empty dirs
  - `readFile(path)` returns string content
  - `listDirectory(path)` returns file paths recursively
  - `fileExists(path)` returns boolean
  - `readFileHash(path)` reads file content and computes hash via Hasher
  - `mergeJsonFile(path, data)` deep merges JSON (for VS Code settings.json)
- [ ] mergeJsonFile preserves existing user content when merging
- [ ] All adapters have integration tests with real filesystem (temp dirs)

## Technical Notes
- ADR-003: MD5 via `node:crypto`. Not a security concern -- used for change detection.
- FileSystemAdapter.mergeJsonFile is critical for Copilot VS Code config merging (US-012).
- Deep merge: arrays are concatenated (deduplicated), objects are recursively merged, scalars from new data override.
- FrameworkLoaderAdapter must handle content section organization types (flat, phase-directories, category-directories).

## Files to Create/Modify
- `src/infrastructure/adapters/framework-loader-adapter.ts` -- implements FrameworkLoader
- `src/infrastructure/adapters/hasher-adapter.ts` -- implements Hasher
- `src/infrastructure/adapters/file-system-adapter.ts` -- implements FileSystem
- `tests/infrastructure/adapters/framework-loader-adapter.test.ts`
- `tests/infrastructure/adapters/hasher-adapter.test.ts`
- `tests/infrastructure/adapters/file-system-adapter.test.ts`

## Tests
- FrameworkLoaderAdapter loads fixture framework.json correctly
- FrameworkLoaderAdapter reads all content files from sections
- HasherAdapter produces correct MD5 hex strings
- HasherAdapter is deterministic (same input -> same output)
- FileSystemAdapter write + read roundtrip
- FileSystemAdapter deleteFile on missing file does not throw
- FileSystemAdapter createDirectory recursive
- FileSystemAdapter deleteEmptyDirectories cleans up
- FileSystemAdapter mergeJsonFile deep merges correctly
- FileSystemAdapter mergeJsonFile preserves existing user keys

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
