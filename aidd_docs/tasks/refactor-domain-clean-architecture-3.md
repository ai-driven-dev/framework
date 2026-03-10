# Refactor: Domain Layer — Clean Architecture & Clean Code (Pass 3)

> Perspective: Martin Fowler — Remove Smells, Don't Add Complexity
> Scope: M1 domain layer only. No behavior change, no feature addition.
> Pre-condition: all 171 tests pass before and after every step.

## Rejected findings

- **`GeneratedFile` class → interface**: Fowler's "Data Class" smell prescribes moving behavior into it, not replacing it with an interface. Immutable class with params-object constructor = idiomatic TypeScript. Large impact, cosmetic benefit.
- **`_` prefix on `private` fields**: style preference, not a Fowler smell. `private` is sufficient to enforce encapsulation, but `_` is a widespread TypeScript convention — no clear consensus to change.

---

## Impact Analysis on Future Milestones

| Refactor | M3 impact | M6 impact | Other |
|---|---|---|---|
| U1: `toTrackedFileData` | none (internal Manifest) | none | none |
| U2: `getConflicts` → `conflicts` | ticket 032: none (no direct access to ConflictSet) | ticket 061: callers must use `.conflicts` | note in 061 |
| U3: remove `DEFAULT_VERBOSE` | none (internal Settings) | none | none |
| U4: remove `_sourcePath` | public `ToolSpec` API changes — ticket 013 to note | none | none |
| U5: `collectRawFiles` (depends on U4) | internal distribution — none | none | none |

---

## U1 — DRY: extract `toTrackedFileData()` in `Manifest.toJSON()`

**Smell:** DRY violation — `files.map(f => ({ relativePath: f.relativePath, hash: f.hash.value }))` appears twice in `toJSON()`: once in the tools loop (lines 115-118), once in the docs block (lines 128-132). Mirror of `toTrackedFiles()` already extracted on the deserialization side.

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/manifest.ts` — extract a private method `toTrackedFileData(files: readonly TrackedFile[]): TrackedFileData[]`
- [x] `src/domain/models/manifest.ts` — replace the two inline `.map()` calls with calls to this method

### Tests

- [x] `pnpm test` passes (171 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required (public API unchanged)

---

## U2 — Remove trivial getter: `ConflictSet.getConflicts()` → public `readonly` field

**Smell:** Unnecessary getter — returns only the private field with a widened type (`ConflictEntry[]` → `readonly ConflictEntry[]`). No calculation, no transformation. In TypeScript, a `public readonly` field exposes data directly without unnecessary ceremony.

**Rule violated:** Fowler "Remove unnecessary accessor" — getter qui ne fait que retourner un champ.

### Code changes

- [x] `src/domain/models/conflict-set.ts` — remove `getConflicts(): readonly ConflictEntry[]`
- [x] `src/domain/models/conflict-set.ts` — rename `private readonly _conflicts: ConflictEntry[]` to `readonly conflicts: readonly ConflictEntry[]` (public)
- [x] `src/domain/models/conflict-set.ts` — update the constructor: `this._conflicts = [...]` → `this.conflicts = [...]`
- [x] `src/domain/models/conflict-set.ts` — update `hasConflicts()`: `this._conflicts.some(...)` → `this.conflicts.some(...)`

### Tests

- [x] `tests/domain/models/conflict-set.test.ts` — update the call `set.getConflicts()` → `set.conflicts`
- [x] `pnpm test` passes (171 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] `aidd_docs/backlog/todo/061_update_conflict_handling.md` — Technical Notes: callers of `ConflictSet` use `.conflicts` (public field) and not `.getConflicts()`

---

## U3 — Remove `DEFAULT_VERBOSE` in `Settings`

**Smell:** Unnecessary named constant — `false` is self-explanatory. Compare: `DEFAULT_REPO` and `DEFAULT_DOCS_DIR` have opaque semantic values. `DEFAULT_VERBOSE = false` adds no additional clarity.

**Rule violated:** Named constants only when the literal is opaque.

### Code changes

- [x] `src/domain/models/settings.ts` — remove `const DEFAULT_VERBOSE = false`
- [x] `src/domain/models/settings.ts` — replace `params?.verbose ?? DEFAULT_VERBOSE` with `params?.verbose ?? false`

### Tests

- [x] `pnpm test` passes (171 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required

---

## U4 — Dead param: remove `_sourcePath` in `getConfigOutputPath`

**Smell:** Dead parameter — declared in the base (`tool-spec.ts:25`) AND in the two overrides (`claude.ts:9`, `cursor.ts:17`), never used by any implementation. Identical to `_section` removed in pass 2.

**Note:** `_configName` in the base remains legitimate (parameter required by the contract, used in overrides).

**Rule violated:** YAGNI / Remove Dead Code.

### Code changes

- [x] `src/domain/models/tool-spec.ts` — remove `_sourcePath: string`: `getConfigOutputPath(_configName: string): string | null`
- [x] `src/domain/tool-specs/claude.ts` — remove `_sourcePath: string`: `getConfigOutputPath(configName: string): string | null`
- [x] `src/domain/tool-specs/cursor.ts` — remove `_sourcePath: string`: `getConfigOutputPath(configName: string): string | null`
- [x] `src/domain/models/distribution.ts` — update the call: `toolSpec.getConfigOutputPath(configRef.name)` (remove `configRef.path`)

### Tests

- [x] `tests/domain/tool-specs/claude.test.ts` — remove the 2nd argument on all `getConfigOutputPath` calls
- [x] `tests/domain/tool-specs/claude.test.ts` — merge/remove the test "returns .mcp.json regardless of source path" (now moot)
- [x] `pnpm test` passes (171 tests, -1 if test removed)
- [x] `pnpm typecheck` passes

### Documentation

- [x] `aidd_docs/backlog/done/013_tool_spec_implementations.md` — Technical Notes: `getConfigOutputPath` takes a single parameter `configName`

---

## U5 — DRY: extract `collectRawFiles()` in `distribution.ts` (depends on U4)

**Smell:** DRY violation — the `configRefs` and `templateRefs` loops have an identical body (lookup content → skip undefined → resolve output → skip null → push result). Only the resolution callback differs. After U4, both callbacks have the same signature `(name: string) => string | null`.

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/distribution.ts` — extraire une fonction locale `collectRawFiles`:
  ```typescript
  function collectRawFiles(
    refs: readonly { name: string; path: string }[],
    resolveOutput: (name: string) => string | null,
    contentFiles: Map<string, string>,
    hasher: Hasher
  ): GeneratedFile[]
  ```
- [x] `src/domain/models/distribution.ts` — replace the two `configRefs` and `templateRefs` loops with calls to this function and merge them into `results`

### Tests

- [x] `pnpm test` passes (identical behavior)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required

---

## Final validation

- [x] `pnpm test` — 171 tests (or -1 if test "regardless of source path" removed)
- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm lint` — 0 violations
- [x] `git grep "getConflicts"` returns zero results in `src/` and `tests/`
- [x] `git grep "_sourcePath"` returns zero results
- [x] `git grep "DEFAULT_VERBOSE"` returns zero results
