---
id: 010
milestone: M1
title: "Implement domain value objects (FileHash, GeneratedFile, StatusReport, Settings)"
stories: []
points: 0
blockedBy: [003]
---

# 010: Implement domain value objects (FileHash, GeneratedFile, StatusReport, Settings)

## Context
The domain layer needs foundational value objects before models and aggregates can be built. These are immutable data carriers with equality semantics and no infrastructure dependencies.

## Scope
Implement FileHash, GeneratedFile, StatusReport, and Settings as domain value objects with full test coverage.

## Acceptance Criteria
- [ ] `FileHash` value object wraps a 32-char MD5 hex string with `equals(other: FileHash): boolean`
- [ ] `FileHash` rejects invalid hex strings (not 32 chars, non-hex characters)
- [ ] `GeneratedFile` value object holds `relativePath: string`, `content: string`, `hash: FileHash`
- [ ] `StatusReport` value object holds per-tool lists of modified, deleted, and untracked files
- [ ] `Settings` value object holds `repo`, `docsDir`, `verbose` with defaults:
  - repo: `"ai-driven-dev/aidd-framework"`
  - docsDir: `"aidd_docs"`
  - verbose: `false`
- [ ] All value objects are immutable (readonly properties)
- [ ] All value objects have zero infrastructure imports
- [ ] Unit tests cover equality, construction, and edge cases

## Technical Notes
- ADR-003: FileHash uses MD5 (32-char hex). Not a security concern -- used for change detection only.
- ADR-008: Settings defaults match the configuration table in architecture.md.
- Naming: PascalCase for types (FileHash, GeneratedFile), camelCase for properties.
- These objects are consumed by Manifest, Distribution, and all use cases.

## Files to Create/Modify
- `src/domain/models/file-hash.ts` -- FileHash value object
- `src/domain/models/generated-file.ts` -- GeneratedFile value object
- `src/domain/models/status-report.ts` -- StatusReport value object
- `src/domain/models/settings.ts` -- Settings value object with defaults
- `tests/domain/models/file-hash.test.ts` -- FileHash tests
- `tests/domain/models/generated-file.test.ts` -- GeneratedFile tests
- `tests/domain/models/status-report.test.ts` -- StatusReport tests
- `tests/domain/models/settings.test.ts` -- Settings tests

## Tests
- FileHash.equals() returns true for same value, false for different
- FileHash constructor rejects invalid input
- GeneratedFile stores path, content, hash correctly
- StatusReport classifies files per tool
- Settings uses defaults when no values provided
- Settings overrides defaults when values provided

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
