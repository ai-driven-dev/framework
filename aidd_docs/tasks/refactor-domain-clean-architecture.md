# Refactor: Domain Layer — Clean Architecture & Clean Code

> Perspective: Martin Fowler — Remove Smells, Don't Add Complexity
> Scope: M1 domain layer only. No behavior change, no feature addition.
> Pre-condition: all 172 tests pass before and after every step.

---

## Impact Analysis on Future Milestones

| Refactor | M2 impact | M3 impact | M7 impact |
|---|---|---|---|
| R1: Remove convertFrontmatter/convertPaths indirection | None | `distribution.ts` call site unchanged | None |
| R2: DRY Claude commands path | None | None | None |
| R3: Inline dead hooks `rewriteAtTools/DocsInclude` | None | None | M7 will add `reverseRewriteContent` — not affected |
| R4: Move `ToolId` to own file | All infra adapters will import from `tool-id.ts` | `InstallUseCase` imports `ToolId` from `tool-id.ts` | None |

Tickets referencing `convertFrontmatter` by name: 012 (done), 013 (done) — public API unchanged.
Tickets referencing `ToolId` by name: 032 (todo) — note in "Technical Notes" that ToolId is in `tool-id.ts`.
Tickets referencing `reverseRewriteContent`: 070, 071 — unaffected by these refactors.

---

## R1 — Remove `convertFrontmatter`/`convertPaths` indirection

**Smell:** Speculative Generalization — public wrapper delegates to protected abstract with no added value.

**Rule violated:** YAGNI, Fowler "Remove Middle Man".

### Code changes

- [x] `src/domain/models/tool-spec.ts` — remove public method `convertFrontmatter()`, rename `protected abstract convertPaths()` to `public abstract convertFrontmatter()`
- [x] `src/domain/tool-specs/claude.ts` — rename `protected convertPaths()` to `public convertFrontmatter()`
- [x] `src/domain/tool-specs/cursor.ts` — rename `protected convertPaths()` to `public convertFrontmatter()`
- [x] `src/domain/tool-specs/copilot.ts` — rename `protected convertPaths()` to `public convertFrontmatter()`

### Tests

- [x] `tests/domain/models/tool-spec.test.ts` — rename `protected convertPaths` in `TestToolSpec` to `public convertFrontmatter`
- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] No changes required (public API unchanged)

---

## R2 — DRY violation in `ClaudeToolSpec` — commands path duplicated

**Smell:** DRY violation — `.claude/commands/aidd/${phase}/` encoded twice in `buildFilePath` and `rewriteContent`.

**Rule violated:** Don't Repeat Yourself — a structure change requires two modifications.

### Code changes

- [x] `src/domain/tool-specs/claude.ts` — extract a private method `commandsDir(phase: string): string` returning `.claude/commands/aidd/${phase}/`
- [x] `src/domain/tool-specs/claude.ts` — replace the two occurrences of the hardcoded pattern with calls to this method

### Tests

- [x] `pnpm test` passes (identical behavior, 172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required (behavior unchanged)

---

## R3 — Remove dead protected hooks `rewriteAtToolsInclude` / `rewriteAtDocsInclude`

**Smell:** Dead Code (for Copilot) + False Template Method contract — Copilot completely overrides `rewriteContent` without calling `super`, making these hooks unusable for it.

**Rule violated:** Liskov Substitution — the base exposes an extension contract that Copilot ignores.

**Decision:** Inline into `rewriteContent` base class, remove `protected` methods.

### Code changes

- [x] `src/domain/models/tool-spec.ts` — inline `this.rewriteAtToolsInclude()` → `` `@${this.directory}` `` directly in `rewriteContent`
- [x] `src/domain/models/tool-spec.ts` — inline `this.rewriteAtDocsInclude(docsDir)` → `` `@${docsDir}/` `` directly in `rewriteContent`
- [x] `src/domain/models/tool-spec.ts` — remove the two methods `protected rewriteAtToolsInclude()` and `protected rewriteAtDocsInclude()`

### Tests

- [x] Verify no test directly calls these protected methods (grep)
- [x] `pnpm test` passes (172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] No changes required

---

## R4 — Move `ToolId` to its own file

**Smell:** Open/Closed violation + responsibility coupling — adding a tool forces modifying `tool-spec.ts` (the abstract class), and `manifest.ts` / `tool-entry.ts` import an enum from a file that defines an unrelated abstract class.

**Rule violated:** Single Responsibility — `tool-spec.ts` defines both the identifier enum and the abstract behavior class.

**Decision:** Create `src/domain/models/tool-id.ts` with only the enum. No re-export from `tool-spec.ts` (clean break — no application/infra/presentation code exists yet).

### Code changes

- [x] Create `src/domain/models/tool-id.ts` with the enum `ToolId { Claude, Cursor, Copilot }`
- [x] `src/domain/models/tool-spec.ts` — remove the `ToolId` definition, import from `./tool-id.js`
- [x] `src/domain/models/manifest.ts` — update `ToolId` import to `./tool-id.js`
- [x] `src/domain/models/tool-entry.ts` — update `ToolId` import to `./tool-id.js`
- [x] `src/domain/tool-specs/claude.ts` — update `ToolId` import to `../models/tool-id.js`
- [x] `src/domain/tool-specs/cursor.ts` — update `ToolId` import to `../models/tool-id.js`
- [x] `src/domain/tool-specs/copilot.ts` — update `ToolId` import to `../models/tool-id.js`

### Tests

- [x] `tests/domain/models/tool-spec.test.ts` — update `ToolId` import to `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/models/manifest.test.ts` — update `ToolId` import to `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/tool-specs/claude.test.ts` — update `ToolId` import to `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/tool-specs/cursor.test.ts` — update `ToolId` import to `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/tool-specs/copilot.test.ts` — update `ToolId` import to `../../../src/domain/models/tool-id.js`
- [x] `pnpm test` passes (172 tests)
- [x] `pnpm typecheck` passes

### Documentation

- [x] `aidd_docs/memory/internal/architecture.md` — add `tool-id.ts` in the Directory Structure and in the ToolId component of the diagram
- [x] `aidd_docs/memory/internal/milestones.md` — M1 Key Deliverables: separate `tool-id.ts` from `tool-spec.ts` in the table
- [x] `aidd_docs/backlog/done/012_tool_spec_model.md` — note that `ToolId` is in `tool-id.ts`
- [x] `aidd_docs/backlog/todo/032_install_use_case.md` — Technical Notes: `ToolId` imported from `tool-id.ts`

---

## Final validation

- [x] `pnpm test` — 172 tests pass
- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm lint` — 0 violations
- [x] `git grep "convertPaths"` returns zero results (dead name removed)
- [x] `git grep "rewriteAtToolsInclude\|rewriteAtDocsInclude"` returns zero results (only in a historical review file)
- [x] `git grep "from.*tool-spec.*ToolId\|ToolId.*from.*tool-spec"` returns zero results (clean break verified)
