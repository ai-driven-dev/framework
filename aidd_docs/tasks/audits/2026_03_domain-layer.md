# Code Review — Domain Layer Audit

Audit du layer domain (`src/domain/`) orienté clean architecture, simplicity, composition.

- Status: findings only — no code changes
- Confidence: 9/10

## Findings Summary

4 catégories de problèmes : God Interface, Duplication, État mutable global, Parsing trop complexe.

---

## Scoring

### Potentially Unnecessary Elements

- [🟢] **`rewrittenBody` alias** `distribution.ts:44` `const rewrittenBody = body` est un no-op — la variable est assignée mais jamais transformée. Renommée immédiatement body. (Supprimer l'alias)
- [🟢] **`escapedRegex`** `copilot.ts:71` Utilitaire interne pour échapper une regex. Utilisé une seule fois pour les placeholders connus — la valeur échappée est constante, calculer dynamiquement n'apporte rien. (Précalculer comme constante ou inliner)

### Standards Compliance

- [🟢] Naming conventions ok — camelCase fonctions, PascalCase classes, UPPER_CASE constantes
- [🟡] **`argument-hint` avec tiret** `claude.ts:65, copilot.ts:160` Accès via `frontmatter["argument-hint"]` car tiret interdit en identifiant. La clé vient du framework source (convention YAML). Acceptable mais fragile — aucun typage fort.

### Architecture

#### A1 — `ToolConfig` : God Interface [🔴]

**`src/domain/models/tool-config.ts:6-18`**

L'interface mélange 6 responsabilités distinctes en un seul contrat :

| Responsabilité | Méthode |
|---|---|
| Identité du tool | `toolId`, `directory`, `toolSuffix` |
| Path par section | `buildFilePath(section, fileName)` |
| Réécriture contenu | `rewriteContent`, `rewriteMemoryBankContent?` |
| Conversion frontmatter | `convertFrontmatter(fm, section, relativeFileName?)` |
| Filtrage | `shouldProcess?(section, frontmatter)` |
| Config files | `getConfigOutputPath`, `shouldMergeConfig?` |
| Memory bank | `getMemoryBankOutputPath` |

Conséquence directe : chaque méthode fait du dispatch interne sur `section.name` :

```ts
// Dans claude.ts, cursor.ts, copilot.ts — toujours le même pattern
if (section.name === SECTION_AGENTS) { ... }
if (section.name === SECTION_COMMANDS) { ... }
if (section.name !== SECTION_RULES) return frontmatter;
```

Le polymorphisme est aplati en if-chain impérative. Chaque nouveau section type force une modification dans chaque tool.

**Proposition** : décomposer par sujet fonctionnel.

```ts
interface SectionHandler {
  buildFilePath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>, relativeFileName?: string): Record<string, unknown>;
  shouldProcess?(fm: Record<string, unknown>): boolean;
}

interface ToolConfig {
  readonly toolId: ToolId;
  readonly directory: string;
  readonly toolSuffix: string;
  rewriteContent(content: string, docsDir: string): string;
  agents(): SectionHandler;
  commands(): SectionHandler;
  rules(): SectionHandler;
  skills(): SectionHandler;
  config(): { outputPath(name: string): string | null; shouldMerge(name: string): boolean };
  memoryBank(): { outputPath(templateName: string): string | null; rewriteContent?(content: string, docsDir: string): string };
}
```

Bénéfices :
- Plus de `section.name` branching dans les implémentations
- Chaque handler est isolé et testable indépendamment
- `shouldProcess` co-localisé avec `rules()` — le seul handler qui l'utilise
- `rewriteMemoryBankContent?` devient optionnel dans son contexte naturel

#### A2 — Méthodes optionnelles cassent le contrat [🟡]

**`tool-config.ts:14,16,17`**

```ts
shouldMergeConfig?(configName: string): boolean;
shouldProcess?(section: ContentSection, frontmatter: Record<string, unknown>): boolean;
rewriteMemoryBankContent?(content: string, docsDir: string): string;
```

Trois méthodes optionnelles avec `?.` dans les callsites. Leur absence a une valeur par défaut implicite (`false`, `true`, `rewriteContent`). Ces défauts devraient être explicites dans l'interface ou dans une base implementation, pas éparpillés dans les callsites.

**`distribution.ts:97`** : `const rewrite = toolConfig.rewriteMemoryBankContent ?? toolConfig.rewriteContent;` — ce fallback est du glue code.

#### A3 — `convertFrontmatter` : signature qui grandit [🟡]

**`tool-config.ts:12`**

```ts
convertFrontmatter(fm, section, relativeFileName?): Record<string, unknown>
```

`relativeFileName?` est optionnel parce qu'il n't est utilisé que pour les commandes (extraction du numéro de phase). C'est une fuite d'implémentation dans l'interface. Avec la décomposition par sujet, `commands().convertFrontmatter(fm, relativeFileName)` est naturel — pas de param optionnel.

#### A4 — `toolPathToInstalledPath` duplique `buildFilePath` [🔴]

**`copilot.ts:75-94`**

`toolPathToInstalledPath` et `buildFilePath` implémentent la même logique de mapping chemin framework → chemin copilot, mais pour deux usages différents (path de fichier vs référence dans le contenu). Ils doivent rester en sync manuellement.

```ts
// buildFilePath pour rules:
flattenFileName(fileName, EXT_INSTRUCTIONS, { stripNumericPrefix: true })
// → .github/instructions/01-mermaid.instructions.md

// toolPathToInstalledPath pour rules:
`instructions/${flattenFileName(file, EXT_INSTRUCTIONS, { stripNumericPrefix: true })}`
// → instructions/01-mermaid.instructions.md (sans DIRECTORY prefix)
```

La seule différence est le préfixe `DIRECTORY`. Cette duplication est le symptôme de `rewriteContent` qui ne peut pas appeler `buildFilePath` parce qu'il n'a pas accès à la `section`. Avec des handlers par section, `rules().buildFilePath(fileName)` serait appelable directement depuis `rewriteContent`.

#### A5 — Extraction du numéro de phase dupliquée [🟡]

**`claude.ts:34`, `claude.ts:61`, `copilot.ts:156`**

Le pattern `segment.match(/^(\d+)/)?.[1]` pour extraire le numéro de phase apparaît 3 fois. Une fonction `extractPhase(dirSegment: string): string | undefined` devrait exister.

#### A6 — Agent frontmatter stripping identique dans les 3 tools [🟡]

**`claude.ts:58`, `cursor.ts:47`, `copilot.ts:153`**

```ts
return { name: frontmatter.name, description: frontmatter.description };
```

Ligne identique dans les 3 outils. Candidat à une fonction partagée `agentFrontmatter(fm)`.

#### A7 — Registre global mutable [🟡]

**`tool-config.ts:36-50`**

```ts
const TOOL_REGISTRY = new Map<ToolId, ToolConfig>();
export function registerTool(config: ToolConfig): void { ... }
```

Side effect à l'import : chaque fichier `claude.ts`, `cursor.ts`, `copilot.ts` appelle `registerTool(...)` en bas de fichier. Le registre est un singleton global mutable — impossible à reset entre tests sans modifier le module.

En pratique les tests n'ont pas besoin du registre (ils importent directement `claudeToolConfig`), mais c'est une fragilité architecturale si on veut tester en isolation.

### Code Health

- [🟢] **Tailles de fichiers** — `copilot.ts` 208 lignes (ok), `claude.ts` 96, `cursor.ts` 68. Dans les limites.
- [🟢] **`distribution.ts`** — 131 lignes, bien découpé en fonctions helper.
- [🟡] **`parseYamlLike`** `frontmatter.ts:53-121` — 68 lignes avec une machine à états (blockScalar + list + keyValue). Trois modes entrelacés avec des variables partagées (`currentKey`, `currentList`, `blockScalarKey`...). Fonctionnel mais dense. Candidat à découpage : `parseBlockScalar`, `parseListItems` séparés.
- [🟡] **`serializeFrontmatter` — détection de glob** `frontmatter.ts:39` `s.includes("*") || s.includes("?") || s.startsWith("{")` — logic de quoting spécifique aux globs dans le serializer générique. Cela n'appartient pas à `frontmatter.ts` — c'est une préoccupation du `ToolConfig.rules()`.
- [🟢] **Cyclomatic complexity** — acceptable partout sauf `parseYamlLike` (>10 branches)
- [🟢] **Error handling** — throw early, messages explicites, pas de silent failures
- [🟢] **No magic numbers/strings** — toutes les constantes nommées dans `framework-descriptor.ts`

### Manque de tests importants

- [🔴] **Snapshot tests absents** — aucun test snapshot sur la sortie complète de `generateDistribution`. Les tests actuels vérifient des propriétés partielles (`toContain`, `toBe`). Un snapshot sur le contenu complet d'un fichier généré attraperait toute régression.
- [🟡] **`toolPathToInstalledPath` non testé directement** `copilot.ts:75` — uniquement couvert indirectement via `rewriteContent`. Si la logique diverge de `buildFilePath`, aucun test ne l'attrape.
- [🟡] **`parseYamlLike` block scalars** — le bloc `>-` est récemment ajouté, couvert par un seul cas implicite via les SKILL.md. Mérite des tests dédiés (edge cases : `|-`, bloc vide, indentation variable).
- [🟢] **`serializeFrontmatter` round-trip** — pas de test de parse → serialize → parse. Un tel test attraperait les régressions de quoting.

---

## Final Review

- **Score**: 7/10 — Architecture fonctionnelle, logique correcte, mais `ToolConfig` est une God Interface qui génère de la duplication et des couplages implicites entre section dispatch et méthodes.
- **Feedback**: La suggestion de l'utilisateur (décomposer par sujet fonctionnel `agents()`, `commands()`, `rules()`...) est la bonne direction. Elle éliminerait les if-chains, les paramètres optionnels de fuite, et la duplication `toolPathToInstalledPath`/`buildFilePath`.
- **Follow-up Actions**:
  1. Ajouter snapshot tests avant tout refactoring (filet de sécurité)
  2. Décomposer `ToolConfig` en handlers par section fonctionnelle
  3. Extraire `extractPhase()` et `agentFrontmatter()` comme helpers partagés
  4. Déplacer la détection de glob hors de `serializeFrontmatter`
  5. Simplifier `parseYamlLike` en séparant les modes de parsing
- **Additional Notes**: Le refactoring doit être sécurisé par snapshots AVANT tout changement structurel. La surface de comportement observable est la sortie de `generateDistribution` — c'est là que les snapshots doivent porter.
