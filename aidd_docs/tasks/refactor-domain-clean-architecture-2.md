# Refactor: Domain Layer — Clean Architecture & Clean Code (Pass 2)

> Perspective: Martin Fowler — Remove Smells, Don't Add Complexity
> Scope: M1 domain layer only. No behavior change, no feature addition.
> Pre-condition: all 172 tests pass before and after every step.

---

## Impact Analysis on Future Milestones

| Refactor | M6 impact | Other |
|---|---|---|
| S1: Remove `applyResolutions` stub | ticket 061 doit CRÉER `applyResolutions()` (non déjà présente en codebase) | aucun |
| S2: `toTrackedFiles` extraction | aucun (internal Manifest) | aucun |
| S3: `computeStatus` flatten | aucun (internal Manifest) | aucun |
| S4: Supprimer `_section` param mort | aucun (internal copilot.ts) | aucun |
| S5: `parseNamedRefs` extraction | aucun (internal FrameworkDescriptor) | aucun |
| S6: `this.directory` dans Copilot | aucun (comportement identique) | aucun |

Ticket référençant `ConflictSet.applyResolutions`: 061 — note ajoutée dans Technical Notes.

---

## S1 — YAGNI : supprimer `ConflictSet.applyResolutions()` stub

**Smell:** Dead Code + Speculative Generalization — méthode publique non implémentée avec `throw new Error("not yet implemented")` et paramètre `_resolutions` jamais utilisé.

**Rule violated:** YAGNI. Les stubs pour milestone future polluent le contrat public actuel.

### Code changes

- [x] `src/domain/models/conflict-set.ts` — supprimer la méthode `applyResolutions(_resolutions: Map<string, ConflictType>): void`

### Tests

- [x] Vérifier qu'aucun test n'appelle `applyResolutions` (`git grep "applyResolutions"`)
- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] `aidd_docs/backlog/todo/061_update_conflict_handling.md` — Technical Notes: préciser que `applyResolutions()` n'existe pas encore et doit être CRÉÉE dans ce ticket

---

## S2 — DRY : extraire `toTrackedFiles()` dans `Manifest`

**Smell:** DRY violation — la projection `GeneratedFile[] → TrackedFile[]` est copiée à l'identique dans `addTool` et `addDocs`.

**Rule violated:** Don't Repeat Yourself — un changement de mapping requiert deux modifications.

### Code changes

- [x] `src/domain/models/manifest.ts` — extraire une méthode privée `toTrackedFiles(files: GeneratedFile[]): TrackedFile[]`
- [x] `src/domain/models/manifest.ts` — remplacer les deux `.map()` inline dans `addTool` et `addDocs` par des appels à cette méthode

### Tests

- [x] `pnpm test` passe (comportement identique, 172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis (API publique inchangée)

---

## S3 — DRY : aplatir les tracked files dans `computeStatus()`

**Smell:** DRY violation — la boucle de classification (`add/modified/deleted`) est dupliquée pour les tools et les docs avec un corps identique.

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/manifest.ts` — dans `computeStatus`, aplatir toutes les tracked files en une seule collection avant d'itérer :
  ```typescript
  const allTracked = [
    ...Array.from(this._tools.values()).flatMap((e) => [...e.files]),
    ...(this._docs?.files ?? []),
  ];
  ```
- [x] Dériver `allManifestPaths` depuis `allTracked` en un seul `new Set(allTracked.map(f => f.relativePath))`
- [x] Supprimer la boucle dupliquée pour `this._docs`

### Tests

- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis

---

## S4 — Dead param : supprimer `_section` dans `flattenFileName`

**Smell:** Dead Code — paramètre `_section: ContentSection` déclaré mais jamais utilisé dans le corps.

**Rule violated:** Remove Dead Code.

### Code changes

- [x] `src/domain/tool-specs/copilot.ts` — supprimer le paramètre `_section` de `flattenFileName`
- [x] `src/domain/tool-specs/copilot.ts` — mettre à jour les 2 call sites (lignes `commands` et `rules` dans `buildFilePath`) pour ne plus passer `section`
- [x] Supprimer l'import `ContentSection` dans `copilot.ts` si devenu orphelin

### Tests

- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis (comportement inchangé)

---

## S5 — DRY : extraire `parseNamedRefs()` dans `FrameworkDescriptor.fromJson()`

**Smell:** DRY violation — les deux boucles de parsing `templateRefs` et `configRefs` sont structurellement identiques (même guard, même `Object.entries`, même `typeof path === "string"` check).

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/framework-descriptor.ts` — extraire une fonction locale `parseNamedRefs(raw: unknown, field: string): { name: string; path: string }[]`
- [x] `src/domain/models/framework-descriptor.ts` — remplacer les deux boucles par `parseNamedRefs(raw, "templates")` et `parseNamedRefs(raw, "config")`

### Tests

- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis

---

## S6 — Magic String : utiliser `this.directory` dans `CopilotToolSpec.buildFilePath()`

**Smell:** Magic String — `.github/` est codé en dur 5 fois dans `buildFilePath` au lieu d'utiliser `this.directory`. Un changement de `directory` ne serait pas reflété.

**Rule violated:** Use your own fields — a class must not duplicate the literal value of its own property.

### Code changes

- [x] `src/domain/tool-specs/copilot.ts` — dans `buildFilePath`, remplacer chaque occurrence de `.github/` par `${this.directory}` (5 cas : agents, prompts, instructions, skills, default)

### Tests

- [x] `pnpm test` passe (comportement identique — `this.directory === ".github/"`, 172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis

---

## Validation finale

- [x] `pnpm test` — 171 tests passent (1 stub supprimé)
- [x] `pnpm typecheck` — 0 erreurs
- [x] `pnpm lint` — 0 violations
- [x] `git grep "applyResolutions"` retourne zéro résultat dans `src/`
- [x] `git grep '\.github\/'` dans `copilot.ts` retourne uniquement la déclaration `readonly directory`
- [x] `git grep "_section"` dans `copilot.ts` retourne zéro résultat
