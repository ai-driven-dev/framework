# Part 9 — FileSystem port split

> Split the 14-method `FileSystem` port into 3 focused ports: `FileReader` (read ops), `FileWriter` (write ops), `FileMerger` (merge/backup/hasLocalChanges). Update all use-case constructors. No user-visible changes.

## Pre-requisites

- No other part required — independent refactor
- `0-port-design.md` already documents this split as the planned exception resolution
- Recommended last in the sequence — mechanical but broad; 30+ use-case constructors touched

## Goal

`src/domain/ports/file-system.ts` has 14 methods, documented as a deliberate exception to the ≤5-method port rule. The split is tracked as a deferred task. This part resolves it.

Current 14 methods grouped:

| Group | Methods | New port |
|---|---|---|
| Read | `readFile`, `listDirectory`, `fileExists`, `readFileHash`, `listFilesRecursive` | `FileReader` |
| Write | `writeFile`, `deleteFile`, `createDirectory`, `deleteEmptyDirectories`, `deleteDirectory`, `chmodExecutable` | `FileWriter` |
| Merge/backup | `mergeJsonFile`, `backup`, `hasLocalChanges` | `FileMerger` |

`FileSystemAdapter` implements all three interfaces (single class, satisfies all three port contracts).

Every use-case constructor that injects `FileSystem` is updated to inject only the sub-ports it actually uses.

## Architecture compliance

- 3 new port files in `src/domain/ports/`:
  - `file-reader.ts` (5 methods — at limit)
  - `file-writer.ts` (6 methods — one over; consider splitting `deleteDirectory`/`deleteEmptyDirectories` into `FileDeleter`, or accept 6 as pragmatic; document decision)
  - `file-merger.ts` (3 methods)
- `src/domain/ports/file-system.ts` deleted (or kept as re-export union for migration period — see risks)
- `FileSystemAdapter` in `src/infrastructure/adapters/file-system-adapter.ts` implements all 3 interfaces
- `deps.ts` injects the correct sub-port per use-case
- Domain pure: no new imports, no logic change in adapters
- No method renamed — signatures unchanged

### Open question: FileWriter has 6 methods

`deleteDirectory` and `deleteEmptyDirectories` could form a 4th `FileDeleter` port. Decision:
- If accepted as-is (6 methods): update `0-port-design.md` exception note
- If split further: 4 ports total, `FileWriter` shrinks to 4 methods

Decide before implementation.

## Steps

### A. Create 3 new port files

- [ ] Create `src/domain/ports/file-reader.ts`:
  ```typescript
  export interface FileReader {
    readFile(path: string): Promise<string>;
    listDirectory(path: string): Promise<string[]>;
    fileExists(path: string): Promise<boolean>;
    readFileHash(path: string): Promise<FileHash>;
    listFilesRecursive(dirPath: string): Promise<string[]>;
  }
  ```
- [ ] Create `src/domain/ports/file-writer.ts`:
  ```typescript
  export interface FileWriter {
    writeFile(path: string, content: string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    createDirectory(path: string): Promise<void>;
    deleteEmptyDirectories(path: string): Promise<void>;
    deleteDirectory(path: string): Promise<void>;
    chmodExecutable(path: string): Promise<void>;
  }
  ```
- [ ] Create `src/domain/ports/file-merger.ts`:
  ```typescript
  export interface FileMerger {
    mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void>;
    backup(absolutePath: string): Promise<string>;
    hasLocalChanges(path: string, knownHash: FileHash): Promise<boolean>;
  }
  ```

### B. Update FileSystemAdapter

- [ ] Add `implements FileReader, FileWriter, FileMerger` to class declaration
- [ ] Verify all 14 methods still present — no signature change
- [ ] `src/domain/ports/file-system.ts` — delete (breaking) OR convert to:
  ```typescript
  // Compatibility re-export — delete after all callers migrated
  export type FileSystem = FileReader & FileWriter & FileMerger;
  ```
  Decision: delete immediately (clean break, single PR).

### C. Update all use-case constructors

- [ ] Run: `rg "FileSystem" src/application/use-cases/ --files-with-matches` — get list of files
- [ ] For each use-case:
  1. Identify which sub-port methods it actually calls
  2. Replace `FileSystem` injection with the narrowest sub-port(s) needed
  3. If a use-case uses methods from 2 or 3 groups, inject all required sub-ports
- [ ] Update constructor parameter types (no logic change)

### D. Update deps.ts

- [ ] `FileSystemAdapter` instance assigned to all 3 sub-port injection points:
  ```typescript
  const fsAdapter = new FileSystemAdapter();
  // inject as FileReader, FileWriter, or FileMerger as needed per use-case
  ```
- [ ] Remove `FileSystem` type references from `deps.ts`

### E. Update 0-port-design.md

- [ ] Remove the `FileSystem` exception note
- [ ] If `FileWriter` stays at 6 methods: add a note explaining the pragmatic decision

### F. Update all mocks/fakes in tests

- [ ] `rg "FileSystem" tests/ --files-with-matches` — identify test files with mocks
- [ ] Split or update mock objects to implement `FileReader`, `FileWriter`, `FileMerger` as appropriate
- [ ] For tests that use all methods: create a combined mock implementing all 3 interfaces

## Tests

### No new domain tests — no logic change

### Existing tests: mechanical mock updates only

- [ ] All tests still pass after mock updates
- [ ] No test constructs `FileSystem` mock — all use `FileReader | FileWriter | FileMerger` mocks

## Acceptance criteria

- [ ] `src/domain/ports/file-system.ts` deleted (no re-export compatibility shim)
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `rg "FileSystem" src/domain/ src/application/` returns zero results
- [ ] `0-port-design.md` exception note removed
- [ ] `FileReader`, `FileWriter`, `FileMerger` each independently mockable in tests
- [ ] Bundle size unchanged (no new runtime code)

## Manual validation

```bash
# Zero refs to old FileSystem type
rg "FileSystem" src/ && echo "FAIL: old type remains" || echo "OK: cleaned"

# Typecheck
pnpm typecheck

# Full test suite
pnpm test
```

## Risks / breaking changes

- Large mechanical refactor: ~30 use-case files, ~20+ test files. High risk of merge conflicts with Parts 1–3 if those parts add new use-cases. Do this part last.
- Use-cases that call methods from multiple groups need 2–3 constructor params instead of 1. May complicate `deps.ts` wiring if not careful.
- If a future use-case needs all 14 methods (unlikely but possible), it injects 3 ports — more verbose but architecturally correct.
- Open question: should `FileSystemAdapter` stay as one class implementing 3 interfaces, or be split into 3 adapters? Single class is pragmatic. Document decision.

## Effort

MEDIUM — ~3–4 days (mechanical but broad).

## Commit

```
refactor(ports): split FileSystem (14 methods) into FileReader/FileWriter/FileMerger

Resolve documented exception in 0-port-design.md. Each new port has ≤6
methods. FileSystemAdapter implements all three (single class). ~30
use-case constructors updated to inject narrowest required sub-port(s).
All test mocks updated. Zero FileSystem references remain in domain/.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-9-fs-port-split.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```
