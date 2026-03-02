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

- [x] `src/domain/models/tool-spec.ts` — supprimer la méthode publique `convertFrontmatter()`, renommer `protected abstract convertPaths()` en `public abstract convertFrontmatter()`
- [x] `src/domain/tool-specs/claude.ts` — renommer `protected convertPaths()` en `public convertFrontmatter()`
- [x] `src/domain/tool-specs/cursor.ts` — renommer `protected convertPaths()` en `public convertFrontmatter()`
- [x] `src/domain/tool-specs/copilot.ts` — renommer `protected convertPaths()` en `public convertFrontmatter()`

### Tests

- [x] `tests/domain/models/tool-spec.test.ts` — renommer `protected convertPaths` dans `TestToolSpec` en `public convertFrontmatter`
- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis (API publique inchangée)

---

## R2 — DRY violation dans `ClaudeToolSpec` — chemin commands dupliqué

**Smell:** DRY violation — `.claude/commands/aidd/${phase}/` encodé deux fois dans `buildFilePath` et `rewriteContent`.

**Rule violated:** Don't Repeat Yourself — un changement de structure requiert deux modifications.

### Code changes

- [x] `src/domain/tool-specs/claude.ts` — extraire une méthode privée `commandsDir(phase: string): string` retournant `.claude/commands/aidd/${phase}/`
- [x] `src/domain/tool-specs/claude.ts` — remplacer les deux occurrences du pattern hardcodé par des appels à cette méthode

### Tests

- [x] `pnpm test` passe (comportement identique, 172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis (comportement inchangé)

---

## R3 — Supprimer les hooks protégés morts `rewriteAtToolsInclude` / `rewriteAtDocsInclude`

**Smell:** Dead Code (pour Copilot) + Faux contrat Template Method — Copilot override complètement `rewriteContent` sans appeler `super`, rendant ces hooks inutilisables pour lui.

**Rule violated:** Liskov Substitution — la base expose un contrat d'extension que Copilot ignore.

**Décision:** Inline dans `rewriteContent` base class, supprimer les méthodes `protected`.

### Code changes

- [x] `src/domain/models/tool-spec.ts` — inliner `this.rewriteAtToolsInclude()` → `` `@${this.directory}` `` directement dans `rewriteContent`
- [x] `src/domain/models/tool-spec.ts` — inliner `this.rewriteAtDocsInclude(docsDir)` → `` `@${docsDir}/` `` directement dans `rewriteContent`
- [x] `src/domain/models/tool-spec.ts` — supprimer les deux méthodes `protected rewriteAtToolsInclude()` et `protected rewriteAtDocsInclude()`

### Tests

- [x] Vérifier qu'aucun test n'appelle directement ces méthodes protégées (grep)
- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] Aucun changement requis

---

## R4 — Déplacer `ToolId` dans son propre fichier

**Smell:** Violation Open/Closed + couplage de responsabilités — ajouter un outil force à modifier `tool-spec.ts` (la classe abstraite), et `manifest.ts` / `tool-entry.ts` importent un enum depuis un fichier qui définit une classe abstraite sans rapport.

**Rule violated:** Single Responsibility — `tool-spec.ts` définit à la fois l'enum des identifiants et la classe abstraite de comportement.

**Décision:** Créer `src/domain/models/tool-id.ts` avec uniquement l'enum. Pas de re-export depuis `tool-spec.ts` (clean break — aucun code application/infra/présentation n'existe encore).

### Code changes

- [x] Créer `src/domain/models/tool-id.ts` avec l'enum `ToolId { Claude, Cursor, Copilot }`
- [x] `src/domain/models/tool-spec.ts` — supprimer la définition de `ToolId`, importer depuis `./tool-id.js`
- [x] `src/domain/models/manifest.ts` — mettre à jour l'import `ToolId` vers `./tool-id.js`
- [x] `src/domain/models/tool-entry.ts` — mettre à jour l'import `ToolId` vers `./tool-id.js`
- [x] `src/domain/tool-specs/claude.ts` — mettre à jour l'import `ToolId` vers `../models/tool-id.js`
- [x] `src/domain/tool-specs/cursor.ts` — mettre à jour l'import `ToolId` vers `../models/tool-id.js`
- [x] `src/domain/tool-specs/copilot.ts` — mettre à jour l'import `ToolId` vers `../models/tool-id.js`

### Tests

- [x] `tests/domain/models/tool-spec.test.ts` — mettre à jour l'import `ToolId` vers `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/models/manifest.test.ts` — mettre à jour l'import `ToolId` vers `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/tool-specs/claude.test.ts` — mettre à jour l'import `ToolId` vers `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/tool-specs/cursor.test.ts` — mettre à jour l'import `ToolId` vers `../../../src/domain/models/tool-id.js`
- [x] `tests/domain/tool-specs/copilot.test.ts` — mettre à jour l'import `ToolId` vers `../../../src/domain/models/tool-id.js`
- [x] `pnpm test` passe (172 tests)
- [x] `pnpm typecheck` passe

### Documentation

- [x] `aidd_docs/memory/internal/architecture.md` — ajouter `tool-id.ts` dans le Directory Structure et dans le composant ToolId du diagramme
- [x] `aidd_docs/memory/internal/milestones.md` — M1 Key Deliverables: séparer `tool-id.ts` de `tool-spec.ts` dans la table
- [x] `aidd_docs/backlog/done/012_tool_spec_model.md` — noter que `ToolId` est dans `tool-id.ts`
- [x] `aidd_docs/backlog/todo/032_install_use_case.md` — Technical Notes: `ToolId` importé depuis `tool-id.ts`

---

## Validation finale

- [x] `pnpm test` — 172 tests passent
- [x] `pnpm typecheck` — 0 erreurs
- [x] `pnpm lint` — 0 violations
- [x] `git grep "convertPaths"` retourne zéro résultat (dead name supprimé)
- [x] `git grep "rewriteAtToolsInclude\|rewriteAtDocsInclude"` retourne zéro résultat (uniquement dans un fichier de review historique)
- [x] `git grep "from.*tool-spec.*ToolId\|ToolId.*from.*tool-spec"` retourne zéro résultat (clean break vérifié)
