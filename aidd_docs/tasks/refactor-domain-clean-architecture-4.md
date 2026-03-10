# Refactor: Domain Layer — Clean Architecture & Clean Code (Pass 4)

> Perspective: Martin Fowler — Remove Smells, Don't Add Complexity
> Scope: M1 domain layer only. No behavior change, no feature addition.
> Pre-condition: all 170 tests pass before and after every step.

## Rejected findings

- **W5: `keyOnlyMatch` redundant regex**: syntactically a subset of `keyValueMatch`, but distinct behavior (list init vs scalar). Merging would require nested `if (rawValue === "")` — less clear, not a Fowler smell.

---

## W1 — DRY: extract `parseTrackedFiles()` in `Manifest.fromJSON()`

**Smell:** DRY violation — the `TrackedFileData → TrackedFile` transformation appears twice in `fromJSON()`: line 157 (tools loop) and line 170 (docs block). Identical lambda: `(f) => ({ relativePath: f.relativePath, hash: new FileHash(f.hash) })`.

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/manifest.ts` — extract `private static parseTrackedFiles(files: TrackedFileData[]): TrackedFile[]`
- [x] `src/domain/models/manifest.ts` — replace the two inline `.map()` calls with calls to this method

### Tests

- [x] `pnpm test` passes (170 tests)
- [x] `pnpm typecheck` passes

---

## W2 — Magic string: `.cursor/` in `CursorToolSpec.getConfigOutputPath()`

**Smell:** Magic string — `".cursor/mcp.json"` hardcodes `.cursor/` whereas `this.directory === ".cursor/"`. Same issue as `copilot.ts` fixed in pass 2.

**Rule violated:** Use `this.field` instead of hardcoding the field's value inline.

### Code changes

- [x] `src/domain/tool-specs/cursor.ts` — replace `return ".cursor/mcp.json"` with `return \`${this.directory}mcp.json\``

### Tests

- [x] `pnpm test` passes (170 tests)
- [x] `pnpm typecheck` passes

---

## W3 — Magic string: `.claude/` in `ClaudeToolSpec.commandsDir()`

**Smell:** Magic string — `\`.claude/commands/aidd/${phase}/\`` hardcodes `.claude/` whereas `this.directory === ".claude/"`.

**Rule violated:** Use `this.field` instead of hardcoding the field's value inline.

### Code changes

- [x] `src/domain/tool-specs/claude.ts` — replace `return \`.claude/commands/aidd/${phase}/\`` with `return \`${this.directory}commands/aidd/${phase}/\``

### Tests

- [x] `pnpm test` passes (170 tests)
- [x] `pnpm typecheck` passes

---

## W4 — DRY: extract `basename()` in `CopilotToolSpec` (depends on W2, W3)

**Smell:** DRY violation — `path.split("/").at(-1) ?? path` appears 3 times in `copilot.ts`:
- `buildFilePath` agents (ligne 12) : `const base = fileName.split("/").at(-1) ?? fileName`
- `rewriteContent` TOOLS (ligne 39) : `const filename = path.split("/").at(-1) ?? path`
- `rewriteContent` DOCS (ligne 43) : `const filename = path.split("/").at(-1) ?? path`

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/tool-specs/copilot.ts` — add a module-level function `function basename(path: string): string { return path.split("/").at(-1) ?? path; }`
- [x] `src/domain/tool-specs/copilot.ts` — replace the 3 inline occurrences with `basename(...)`

### Tests

- [x] `pnpm test` passes (170 tests)
- [x] `pnpm typecheck` passes

---

## Final validation

- [x] `pnpm test` — 170 tests
- [x] `pnpm typecheck` — 0 errors
- [x] `pnpm lint` — 0 violations
- [x] `git grep '".cursor/mcp.json"'` returns zero results in `src/`
- [x] `git grep '".claude/commands'` returns zero results in `src/`
