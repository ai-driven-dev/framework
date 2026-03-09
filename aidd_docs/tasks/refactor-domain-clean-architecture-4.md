# Refactor: Domain Layer — Clean Architecture & Clean Code (Pass 4)

> Perspective: Martin Fowler — Remove Smells, Don't Add Complexity
> Scope: M1 domain layer only. No behavior change, no feature addition.
> Pre-condition: all 170 tests pass before and after every step.

## Findings non retenus

- **W5: `keyOnlyMatch` regex redondante** : syntaxiquement sous-ensemble de `keyValueMatch`, mais comportement distinct (init liste vs scalaire). Fusion nécessiterait `if (rawValue === "")` imbriqué — moins clair, pas un smell Fowler.

---

## W1 — DRY : extraire `parseTrackedFiles()` dans `Manifest.fromJSON()`

**Smell:** DRY violation — la transformation `TrackedFileData → TrackedFile` apparaît deux fois dans `fromJSON()` : ligne 157 (boucle tools) et ligne 170 (bloc docs). Lambda identique : `(f) => ({ relativePath: f.relativePath, hash: new FileHash(f.hash) })`.

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/manifest.ts` — extraire `private static parseTrackedFiles(files: TrackedFileData[]): TrackedFile[]`
- [x] `src/domain/models/manifest.ts` — remplacer les deux `.map()` inline par des appels à cette méthode

### Tests

- [x] `pnpm test` passe (170 tests)
- [x] `pnpm typecheck` passe

---

## W2 — Magic string : `.cursor/` dans `CursorToolSpec.getConfigOutputPath()`

**Smell:** Magic string — `".cursor/mcp.json"` hardcode `.cursor/` alors que `this.directory === ".cursor/"`. Même problème que `copilot.ts` corrigé en pass 2.

**Rule violated:** Use `this.field` instead of hardcoding the field's value inline.

### Code changes

- [x] `src/domain/tool-specs/cursor.ts` — remplacer `return ".cursor/mcp.json"` par `return \`${this.directory}mcp.json\``

### Tests

- [x] `pnpm test` passe (170 tests)
- [x] `pnpm typecheck` passe

---

## W3 — Magic string : `.claude/` dans `ClaudeToolSpec.commandsDir()`

**Smell:** Magic string — `\`.claude/commands/aidd/${phase}/\`` hardcode `.claude/` alors que `this.directory === ".claude/"`.

**Rule violated:** Use `this.field` instead of hardcoding the field's value inline.

### Code changes

- [x] `src/domain/tool-specs/claude.ts` — remplacer `return \`.claude/commands/aidd/${phase}/\`` par `return \`${this.directory}commands/aidd/${phase}/\``

### Tests

- [x] `pnpm test` passe (170 tests)
- [x] `pnpm typecheck` passe

---

## W4 — DRY : extraire `basename()` dans `CopilotToolSpec` (dépend de W2, W3)

**Smell:** DRY violation — `path.split("/").at(-1) ?? path` apparaît 3 fois dans `copilot.ts` :
- `buildFilePath` agents (ligne 12) : `const base = fileName.split("/").at(-1) ?? fileName`
- `rewriteContent` TOOLS (ligne 39) : `const filename = path.split("/").at(-1) ?? path`
- `rewriteContent` DOCS (ligne 43) : `const filename = path.split("/").at(-1) ?? path`

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/tool-specs/copilot.ts` — ajouter une fonction module-level `function basename(path: string): string { return path.split("/").at(-1) ?? path; }`
- [x] `src/domain/tool-specs/copilot.ts` — remplacer les 3 occurrences inline par `basename(...)`

### Tests

- [x] `pnpm test` passe (170 tests)
- [x] `pnpm typecheck` passe

---

## Validation finale

- [x] `pnpm test` — 170 tests
- [x] `pnpm typecheck` — 0 erreurs
- [x] `pnpm lint` — 0 violations
- [x] `git grep '".cursor/mcp.json"'` retourne zéro résultat dans `src/`
- [x] `git grep '".claude/commands'` retourne zéro résultat dans `src/`
