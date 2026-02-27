---
id: 016
milestone: M1
title: "Define all domain port interfaces"
stories: []
points: 0
blockedBy: [015, 014]
---

# 016: Define all domain port interfaces

## Context
Domain ports are the interfaces that define how the domain interacts with the outside world. Infrastructure adapters will implement these ports. Defining them completes the domain layer and unblocks all infrastructure work in M2.

## Scope
Define all 8 port interfaces. Also implement ConflictSet (v3.1+ seam with stubs) to complete the domain model surface.

## Acceptance Criteria
- [ ] `ManifestRepository` port: `load(): Promise<Manifest | null>`, `save(manifest: Manifest): Promise<void>`, `delete(): Promise<void>`
- [ ] `SettingsRepository` port: `load(): Promise<Settings>`
- [ ] `FileSystem` port: `writeFile(path, content)`, `deleteFile(path)`, `createDirectory(path)`, `deleteEmptyDirectories(path)`, `readFile(path)`, `listDirectory(path)`, `fileExists(path)`, `readFileHash(path)`, `mergeJsonFile(path, data)`
- [ ] `FrameworkLoader` port: `loadFromDirectory(path): Promise<{descriptor: FrameworkDescriptor, contentFiles: Map<string, string>}>`
- [ ] `FrameworkResolver` port: `resolve(options): Promise<string>` (returns local dir path), `getLatestVersion(): Promise<string | null>`
- [ ] `Hasher` port: `hash(content: string): FileHash`
- [ ] `Prompter` port: `confirm(message): Promise<boolean>`, `select(message, choices): Promise<string>`, `checkbox(message, choices): Promise<string[]>`
- [ ] `Logger` port: `debug(message)`, `info(message)`, `warn(message)`
- [ ] `ConflictSet` value object with stubbed methods: `classify()`, `getConflicts()`, `applyResolutions()` -- tested stubs for v3.1+ seam
- [ ] All ports are TypeScript interfaces (not classes)
- [ ] All ports live in `src/domain/ports/`
- [ ] ConflictSet compiles and has test coverage for stub behavior
- [ ] Zero infrastructure imports in any domain file

## Technical Notes
- Ports define the contract; infrastructure implements it. This is the Clean Architecture dependency rule.
- Prompter is used in v3.1+ but defined now so the architecture is complete.
- ConflictSet.classify() takes (manifestHash, diskHash, newHash) and returns a ConflictType enum.
- Logger should be lightweight -- it could be a function rather than a full class.

## Files to Create/Modify
- `src/domain/ports/manifest-repository.ts`
- `src/domain/ports/settings-repository.ts`
- `src/domain/ports/file-system.ts`
- `src/domain/ports/framework-loader.ts`
- `src/domain/ports/framework-resolver.ts`
- `src/domain/ports/hasher.ts`
- `src/domain/ports/prompter.ts`
- `src/domain/ports/logger.ts`
- `src/domain/models/conflict-set.ts` -- ConflictSet with stubs
- `tests/domain/models/conflict-set.test.ts` -- stub behavior tests
- `tests/domain/ports/ports.test.ts` -- compilation/type check for all ports

## Tests
- All port interfaces compile without error (type-level test)
- ConflictSet.classify() returns correct ConflictType for each combination
- ConflictSet.getConflicts() returns conflict files
- ConflictSet stubs throw or return safe defaults for unimplemented paths

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
