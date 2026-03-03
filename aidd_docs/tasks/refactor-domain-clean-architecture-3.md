# Refactor: Domain Layer — Clean Architecture & Clean Code (Pass 3)

> Perspective: Martin Fowler — Remove Smells, Don't Add Complexity
> Scope: M1 domain layer only. No behavior change, no feature addition.
> Pre-condition: all 171 tests pass before and after every step.

## Findings non retenus

- **`GeneratedFile` classe → interface** : le smell "Data Class" de Fowler prescrit d'y déplacer du comportement, pas de le remplacer par une interface. Classe immuable avec constructeur params-object = idiomatique TypeScript. Impact large, bénéfice cosmétique.
- **`_` prefix sur champs `private`** : préférence de style, pas un smell Fowler. `private` suffit à enforcer l'encapsulation, mais le `_` est une convention répandue en TypeScript — pas de consensus clair pour changer.

---

## Impact Analysis on Future Milestones

| Refactor | M3 impact | M6 impact | Other |
|---|---|---|---|
| U1: `toTrackedFileData` | aucun (internal Manifest) | aucun | aucun |
| U2: `getConflicts` → `conflicts` | ticket 032 : aucun (pas d'accès direct à ConflictSet) | ticket 061 : callers doivent utiliser `.conflicts` | note dans 061 |
| U3: supprimer `DEFAULT_VERBOSE` | aucun (internal Settings) | aucun | aucun |
| U4: supprimer `_sourcePath` | API publique `ToolSpec` change — ticket 013 à noter | aucun | aucun |
| U5: `collectRawFiles` (dépend de U4) | internal distribution — aucun | aucun | aucun |

---

## U1 — DRY : extraire `toTrackedFileData()` dans `Manifest.toJSON()`

**Smell:** DRY violation — `files.map(f => ({ relativePath: f.relativePath, hash: f.hash.value }))` apparaît deux fois dans `toJSON()` : une fois dans la boucle tools (lignes 115-118), une fois dans le bloc docs (lignes 128-132). Miroir de `toTrackedFiles()` déjà extrait côté désérialisation.

**Rule violated:** Don't Repeat Yourself.

### Code changes

- [x] `src/domain/models/manifest.ts` — extraire une méthode privée `toTrackedFileData(files: readonly TrackedFile[]): TrackedFileData[]`
- [x] `src/domain/models/manifest.ts` — remplacer les deux `.map()` inline par des appels à cette méthode

### Tests

- [x] `pnpm test` passe (171 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis (API publique inchangée)

---

## U2 — Remove getter trivial : `ConflictSet.getConflicts()` → champ public `readonly`

**Smell:** Unnecessary getter — retourne uniquement le champ privé avec un type élargi (`ConflictEntry[]` → `readonly ConflictEntry[]`). Aucun calcul, aucune transformation. En TypeScript, un champ `public readonly` expose directement les données sans cérémonie inutile.

**Rule violated:** Fowler "Remove unnecessary accessor" — getter qui ne fait que retourner un champ.

### Code changes

- [x] `src/domain/models/conflict-set.ts` — supprimer `getConflicts(): readonly ConflictEntry[]`
- [x] `src/domain/models/conflict-set.ts` — renommer `private readonly _conflicts: ConflictEntry[]` en `readonly conflicts: readonly ConflictEntry[]` (public)
- [x] `src/domain/models/conflict-set.ts` — mettre à jour le constructeur : `this._conflicts = [...]` → `this.conflicts = [...]`
- [x] `src/domain/models/conflict-set.ts` — mettre à jour `hasConflicts()` : `this._conflicts.some(...)` → `this.conflicts.some(...)`

### Tests

- [x] `tests/domain/models/conflict-set.test.ts` — mettre à jour l'appel `set.getConflicts()` → `set.conflicts`
- [x] `pnpm test` passe (171 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] `aidd_docs/backlog/todo/061_update_conflict_handling.md` — Technical Notes : callers de `ConflictSet` utilisent `.conflicts` (champ public) et non `.getConflicts()`

---

## U3 — Supprimer `DEFAULT_VERBOSE` dans `Settings`

**Smell:** Unnecessary named constant — `false` est auto-explicatif. Comparer : `DEFAULT_REPO` et `DEFAULT_DOCS_DIR` ont une valeur sémantique opaque. `DEFAULT_VERBOSE = false` n'apporte aucune clarté supplémentaire.

**Rule violated:** Named constants only when the literal is opaque.

### Code changes

- [x] `src/domain/models/settings.ts` — supprimer `const DEFAULT_VERBOSE = false`
- [x] `src/domain/models/settings.ts` — remplacer `params?.verbose ?? DEFAULT_VERBOSE` par `params?.verbose ?? false`

### Tests

- [x] `pnpm test` passe (171 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis

---

## U4 — Dead param : supprimer `_sourcePath` dans `getConfigOutputPath`

**Smell:** Dead parameter — déclaré dans la base (`tool-spec.ts:25`) ET dans les deux overrides (`claude.ts:9`, `cursor.ts:17`), jamais utilisé par aucune implémentation. Identique à `_section` supprimé en passe 2.

**Note:** `_configName` dans la base reste légitime (paramètre requis par le contrat, utilisé dans les overrides).

**Rule violated:** YAGNI / Remove Dead Code.

### Code changes

- [x] `src/domain/models/tool-spec.ts` — supprimer `_sourcePath: string` : `getConfigOutputPath(_configName: string): string | null`
- [x] `src/domain/tool-specs/claude.ts` — supprimer `_sourcePath: string` : `getConfigOutputPath(configName: string): string | null`
- [x] `src/domain/tool-specs/cursor.ts` — supprimer `_sourcePath: string` : `getConfigOutputPath(configName: string): string | null`
- [x] `src/domain/models/distribution.ts` — mettre à jour l'appel : `toolSpec.getConfigOutputPath(configRef.name)` (supprimer `configRef.path`)

### Tests

- [x] `tests/domain/tool-specs/claude.test.ts` — supprimer le 2e argument sur tous les appels `getConfigOutputPath`
- [x] `tests/domain/tool-specs/claude.test.ts` — fusionner/supprimer le test "returns .mcp.json regardless of source path" (devenu sans objet)
- [x] `pnpm test` passe (171 tests, -1 si test supprimé)
- [x] `pnpm typecheck` passe

### Documentation

- [x] `aidd_docs/backlog/done/013_tool_spec_implementations.md` — Technical Notes : `getConfigOutputPath` prend un seul paramètre `configName`

---

## U5 — DRY : extraire `collectRawFiles()` dans `distribution.ts` (dépend de U4)

**Smell:** DRY violation — les boucles `configRefs` et `templateRefs` ont un corps identique (lookup contenu → skip undefined → resolve output → skip null → push résultat). Seul le callback de résolution diffère. Après U4, les deux callbacks ont la même signature `(name: string) => string | null`.

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
- [x] `src/domain/models/distribution.ts` — remplacer les deux boucles `configRefs` et `templateRefs` par des appels à cette fonction et les fusionner dans `results`

### Tests

- [x] `pnpm test` passe (comportement identique)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis

---

## Validation finale

- [x] `pnpm test` — 171 tests (ou -1 si test "regardless of source path" supprimé)
- [x] `pnpm typecheck` — 0 erreurs
- [x] `pnpm lint` — 0 violations
- [x] `git grep "getConflicts"` retourne zéro résultat dans `src/` et `tests/`
- [x] `git grep "_sourcePath"` retourne zéro résultat
- [x] `git grep "DEFAULT_VERBOSE"` retourne zéro résultat
