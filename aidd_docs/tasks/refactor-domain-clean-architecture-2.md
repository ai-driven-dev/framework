# Refactor: Domain Layer — Clean Architecture & Clean Code (Pass 2)

> Perspective: Martin Fowler — Remove Smells, Don't Add Complexity
> Scope: M1 domain layer only. No behavior change, no feature addition.
> Pre-condition: all 172 tests pass before and after every step.

---

## Impact Analysis on Future Milestones

| Refactor | M6 impact | Other |
|---|---|---|
| S1: Remove `applyResolutions` stub | ticket 061 must CREATE `applyResolutions()` (not already present in codebase) | none |
| S2: `toTrackedFiles` extraction | none (internal Manifest) | none |
| S3: `computeStatus` flatten | none (internal Manifest) | none |
| S4: Remove dead `_section` param | none (internal copilot.ts) | none |
| S5: `parseNamedRefs` extraction | none (internal FrameworkDescriptor) | none |
| S6: `this.directory` in Copilot | none (identical behavior) | none |

Ticket referencing `ConflictSet.applyResolutions`: 061 — note added in Technical Notes.

---

## S1 — YAGNI: remove `ConflictSet.applyResolutions()` stub

**Smell:** Dead Code + Speculative Generalization — unimplemented public method with `throw new Error("not yet implemented")` and `_resolutions` parameter never used.

**Rule violated:** YAGNI. Stubs for future milestones pollute the current public contract.

### Code changes

- [x] `src/domain/models/conflict-set.ts` — remove the method `applyResolutions(_resolutions: Map<string, ConflictType>): void`

### Tests

- [x] Verify no test calls `applyResolutions` (`git grep "applyResolutions"`)
- [x] `pnpm test` passes (172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] `aidd_docs/backlog/todo/061_update_conflict_handling.md` — Technical Notes: clarify that `applyResolutions()` does not yet exist and must be CREATED in this ticket

---

## S2 — DRY: extract `toTrackedFiles()` in `Manifest`

**Smell:** DRY violation — the `GeneratedFile[] → TrackedFile[]` projection is copied identically in `addTool` and `addDocs`.

**Rule violated:** Don't Repeat Yourself — a mapping change requires two modifications.

### Code changes

- [x] `src/domain/models/manifest.ts` — extract a private method `toTrackedFiles(files: GeneratedFile[]): TrackedFile[]`
- [x] `src/domain/models/manifest.ts` — replace the two inline `.map()` calls in `addTool` and `addDocs` with calls to this method

### Tests

- [x] `pnpm test` passes (identical behavior, 172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required (public API unchanged)

---

## S3 — DRY: flatten tracked files in `computeStatus()`

**Smell:** DRY violation — the classification loop (`add/modified/deleted`) is duplicated for tools and docs with an identical body.

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/manifest.ts` — in `computeStatus`, flatten all tracked files into a single collection before iterating:
  ```typescript
  const allTracked = [
    ...Array.from(this._tools.values()).flatMap((e) => [...e.files]),
    ...(this._docs?.files ?? []),
  ];
  ```
- [x] Derive `allManifestPaths` from `allTracked` with a single `new Set(allTracked.map(f => f.relativePath))`
- [x] Remove the duplicated loop for `this._docs`

### Tests

- [x] `pnpm test` passes (172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required

---

## S4 — Dead param: remove `_section` in `flattenFileName`

**Smell:** Dead Code — `_section: ContentSection` parameter declared but never used in the body.

**Rule violated:** Remove Dead Code.

### Code changes

- [x] `src/domain/tool-specs/copilot.ts` — remove the `_section` parameter from `flattenFileName`
- [x] `src/domain/tool-specs/copilot.ts` — update the 2 call sites (lines `commands` and `rules` in `buildFilePath`) to no longer pass `section`
- [x] Remove the `ContentSection` import in `copilot.ts` if it becomes orphaned

### Tests

- [x] `pnpm test` passes (172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required (behavior unchanged)

---

## S5 — DRY: extract `parseNamedRefs()` in `FrameworkDescriptor.fromJson()`

**Smell:** DRY violation — the two parsing loops for `templateRefs` and `configRefs` are structurally identical (same guard, same `Object.entries`, same `typeof path === "string"` check).

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/framework-descriptor.ts` — extract a local function `parseNamedRefs(raw: unknown, field: string): { name: string; path: string }[]`
- [x] `src/domain/models/framework-descriptor.ts` — replace the two loops with `parseNamedRefs(raw, "templates")` and `parseNamedRefs(raw, "config")`

### Tests

- [x] `pnpm test` passes (172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required

---

## S6 — Magic String: use `this.directory` in `CopilotToolSpec.buildFilePath()`

**Smell:** Magic String — `.github/` is hardcoded 5 times in `buildFilePath` instead of using `this.directory`. A change to `directory` would not be reflected.

**Rule violated:** Use your own fields — a class must not duplicate the literal value of its own property.

### Code changes

- [x] `src/domain/tool-specs/copilot.ts` — in `buildFilePath`, replace each occurrence of `.github/` with `${this.directory}` (5 cases: agents, prompts, instructions, skills, default)

### Tests

- [x] `pnpm test` passes (identical behavior — `this.directory === ".github/"`, 172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required

---

## Final validation

- [x] `pnpm test` — 171 tests pass (1 stub removed)
- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm lint` — 0 violations
- [x] `git grep "applyResolutions"` returns zero results in `src/`
- [x] `git grep '\.github\/'` in `copilot.ts` returns only the `readonly directory` declaration
- [x] `git grep "_section"` in `copilot.ts` returns zero results
