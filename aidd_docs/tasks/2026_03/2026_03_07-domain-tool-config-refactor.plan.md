# Plan — ToolConfig Domain Refactor

**Objectif** : Décomposer `ToolConfig` God Interface en handlers par sujet fonctionnel.
**Contraintes** : aucun helper module partagé, full domain clean code, behavior préservé par snapshots.

---

## Contexte

`ToolConfig` mélange 6 responsabilités et force un dispatch `if (section.name === X)` dans chaque implémentation tool. Chaque section a ses propres règles mais l'interface les aplatit dans des méthodes génériques avec paramètres optionnels.

Fichiers impactés : `src/domain/models/tool-config.ts`, `src/domain/models/distribution.ts`, `src/domain/tools/claude.ts`, `src/domain/tools/cursor.ts`, `src/domain/tools/copilot.ts`.

---

## Nouvelle interface cible

```ts
// tool-config.ts

export interface SectionHandler {
  buildFilePath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown>;
}

export interface CommandsHandler {
  buildFilePath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>, relativeFileName: string): Record<string, unknown>;
}

export interface RulesHandler {
  buildFilePath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown>;
  shouldProcess(fm: Record<string, unknown>): boolean;
}

export interface ConfigHandler {
  outputPath(configName: string): string | null;
  shouldMerge(configName: string): boolean;
}

export interface MemoryBankHandler {
  outputPath(templateName: string): string | null;
  rewriteContent(content: string, docsDir: string): string;
}

export interface ToolConfig {
  readonly toolId: ToolId;
  readonly directory: string;
  readonly toolSuffix: string;
  rewriteContent(content: string, docsDir: string): string;
  agents(): SectionHandler;
  commands(): CommandsHandler;
  rules(): RulesHandler;
  skills(): SectionHandler;
  config(): ConfigHandler;
  memoryBank(): MemoryBankHandler;
}
```

---

## Impact sur `distribution.ts`

Avant (dispatch via `section` passé aux méthodes) :
```ts
const outputPath = toolConfig.buildFilePath(section, relativeFileName);
if (toolConfig.shouldProcess?.(section, frontmatter) === false) continue;
const converted = toolConfig.convertFrontmatter(frontmatter, section, relativeFileName);
```

Après (dispatch explicite par sujet) :
```ts
const handler = resolveHandler(toolConfig, section.name);
if (!handler) continue;

const outputPath = handler.buildFilePath(relativeFileName);
if (outputPath === null) continue;
// ...
const converted = section.name === SECTION_COMMANDS
  ? toolConfig.commands().convertFrontmatter(frontmatter, relativeFileName)
  : handler.convertFrontmatter(frontmatter);
```

Fonction de dispatch dans `distribution.ts` :
```ts
function resolveHandler(
  toolConfig: ToolConfig,
  sectionName: string
): SectionHandler | CommandsHandler | RulesHandler | null {
  switch (sectionName) {
    case SECTION_AGENTS:   return toolConfig.agents();
    case SECTION_COMMANDS: return toolConfig.commands();
    case SECTION_RULES:    return toolConfig.rules();
    case SECTION_SKILLS:   return toolConfig.skills();
    default: return null;
  }
}
```

`shouldProcess` est appelé seulement quand la section est `rules` :
```ts
if (section.name === SECTION_RULES && !toolConfig.rules().shouldProcess(frontmatter)) continue;
```

Config et memoryBank remplacent :
- `getConfigOutputPath` / `shouldMergeConfig?` → `toolConfig.config().outputPath(name)` / `toolConfig.config().shouldMerge(name)`
- `getMemoryBankOutputPath` / `rewriteMemoryBankContent?` → `toolConfig.memoryBank().outputPath(name)` / `toolConfig.memoryBank().rewriteContent(content, docsDir)`

---

## Déduplication Copilot — `toolPathToInstalledPath`

Problème actuel : `toolPathToInstalledPath` et les paths retournés par `buildFilePath` doublonnent la logique de mapping.

Solution : définir les handlers comme objets nommés AVANT `rewriteContent`, puis les utiliser depuis `rewriteContent` :

```ts
// copilot.ts

const rulesHandler: RulesHandler = {
  buildFilePath(fileName) { /* ... */ },
  convertFrontmatter(fm) { /* ... */ },
  shouldProcess(fm) { /* ... */ },
};

function rewriteCopilotContent(content: string, docsDir: string): string {
  return content
    .replace(AT_TOOLS_PLACEHOLDER_RULES_REGEX, (_match, path) => {
      const installedPath = rulesHandler.buildFilePath(path.slice("rules/".length));
      return installedPath ? `[${installedPath}](../../${installedPath})` : path;
    })
    // ...
}
```

`toolPathToInstalledPath` est supprimé — sa logique vit dans les handlers concernés.

---

## Extraction phase — scope par tool

Le pattern `segment.match(/^(\d+)/)?.[1]` reste en inline dans les `commands()` handlers de `claude.ts` et `copilot.ts`. Pas de module partagé — c'est du comportement spécifique à chaque tool.

---

## Agent frontmatter stripping — par handler

`{ name: fm.name, description: fm.description }` reste dans chaque `agents().convertFrontmatter` — co-localisé avec la logique de chaque tool. Pas d'extraction cross-tool.

---

## Étapes d'implémentation

### Étape 1 — Snapshot tests (filet de sécurité)

Ajouter dans `tests/domain/models/distribution.test.ts` des tests snapshot sur le contenu complet de fichiers générés pour les 3 tools :

```ts
it("snapshot: Claude agents content", () => {
  const files = generateDistribution(framework, claudeToolConfig, "aidd_docs", contentFiles, stubHasher);
  const agent = files.find(f => f.relativePath.includes("agents/"));
  expect(agent?.content).toMatchSnapshot();
});
// idem pour rules, commands, skills, config, memoryBank
// idem pour cursor et copilot
```

Exécuter `vitest --update-snapshots` pour établir la baseline.

### Étape 2 — Nouveaux types dans `tool-config.ts`

1. Ajouter `SectionHandler`, `CommandsHandler`, `RulesHandler`, `ConfigHandler`, `MemoryBankHandler`
2. Remplacer l'interface `ToolConfig` par la nouvelle
3. Supprimer les méthodes monolithiques de l'ancienne interface
4. Conserver `acceptsFile`, `stripToolSuffix`, `VALID_TOOL_IDS`, `ToolId`, le registre

**Pas de changement aux tools ni à distribution.ts encore** — TypeScript indiquera les erreurs à résoudre en étape 3 et 4.

### Étape 3 — Refactor `distribution.ts`

Remplacer les appels aux anciennes méthodes monolithiques par les dispatches handlers.
Pas de changement de comportement observable — les snapshots doivent passer.

### Étape 4 — Refactor `claude.ts`

Restructurer `claudeToolConfig` en implémentant la nouvelle interface :

```ts
export const claudeToolConfig: ToolConfig = {
  toolId: "claude",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  rewriteContent(...) { ... },
  agents() { return { buildFilePath: ..., convertFrontmatter: ... }; },
  commands() { return { buildFilePath: ..., convertFrontmatter: ... }; },
  rules() { return { buildFilePath: ..., convertFrontmatter: ..., shouldProcess: ... }; },
  skills() { return { buildFilePath: ..., convertFrontmatter: (fm) => fm }; },
  config() { return { outputPath: ..., shouldMerge: ... }; },
  memoryBank() { return { outputPath: ..., rewriteContent: ... }; },
};
```

Vérifier que les snapshots passent toujours.

### Étape 5 — Refactor `cursor.ts`

Même structure. Cursor n'a pas de `rewriteMemoryBankContent` ni `shouldProcess` — les implémentations retournent des valeurs par défaut explicites :
- `rules().shouldProcess(fm)` → `true` (cursor accepte toutes les rules)
- `memoryBank().rewriteContent` → identique à `rewriteContent` global

### Étape 6 — Refactor `copilot.ts`

1. Définir chaque handler comme objet nommé (`agentsHandler`, `commandsHandler`, `rulesHandler`, `skillsHandler`)
2. Refactorer `rewriteContent` pour utiliser les handlers au lieu de `toolPathToInstalledPath`
3. Supprimer `toolPathToInstalledPath`
4. Implémenter `copilotToolConfig` avec la nouvelle interface

### Étape 7 — Mise à jour des tests unitaires tools

Les tests dans `tests/domain/tools/` appellent directement les méthodes. Migrer vers :
```ts
claudeToolConfig.agents().buildFilePath("agent.md")
claudeToolConfig.rules().shouldProcess({ paths: ["**/*.ts"] })
// etc.
```

### Étape 8 — Vérification finale

- `pnpm test` — tous les tests passent
- Snapshots identiques (pas de `--update-snapshots`)
- `pnpm build` — pas d'erreur TypeScript
- `pnpm lint` — clean

---

### Étape 9 — Refactor `parseYamlLike` (post-ToolConfig)

**Problème** : la fonction est une machine à états avec 5 variables mutables partagées (`currentKey`, `currentList`, `blockScalarKey`, `blockScalarLines`, `blockScalarFolded`) et 3 modes entrelacés. Cyclomatic complexity > 10.

**Solution** : remplacer la boucle avec état mutable par une approche index-based, où chaque mode de parsing est une fonction autonome qui avance explicitement l'index :

```ts
function parseYamlLike(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyOnlyMatch = /^(\w[\w-]*):\s*$/.exec(line);
    const keyValueMatch = /^(\w[\w-]*):\s*(.+)$/.exec(line);
    if (keyOnlyMatch) {
      const { items, next } = collectListBlock(lines, i + 1);
      result[keyOnlyMatch[1]] = items;
      i = next;
    } else if (keyValueMatch) {
      const rawValue = keyValueMatch[2].trim();
      if (isBlockScalarIndicator(rawValue)) {
        const { value, next } = collectScalarBlock(lines, i + 1, rawValue.startsWith(">"));
        result[keyValueMatch[1]] = value;
        i = next;
      } else {
        result[keyValueMatch[1]] = parseScalar(rawValue);
        i++;
      }
    } else {
      i++;
    }
  }
  return result;
}

function collectListBlock(lines: string[], start: number): { items: string[]; next: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const match = /^\s{2,}-\s+(.+)$/.exec(lines[i]);
    if (!match) break;
    items.push(match[1].trim());
    i++;
  }
  return { items, next: i };
}

function collectScalarBlock(
  lines: string[],
  start: number,
  folded: boolean
): { value: string; next: number } {
  const collected: string[] = [];
  let i = start;
  while (i < lines.length && /^\s+/.test(lines[i])) {
    collected.push(lines[i].trim());
    i++;
  }
  const value = folded ? collected.join(" ").trimEnd() : collected.join("\n").trimEnd();
  return { value, next: i };
}

function isBlockScalarIndicator(s: string): boolean {
  return s === ">-" || s === ">" || s === "|-" || s === "|";
}
```

Bénéfices :
- Aucune variable d'état partagée entre les modes
- Chaque sous-fonction est testable et lisible indépendamment
- Cyclomatic complexity divisée par 3
- `flushBlockScalar()` nested function supprimée

Mise à jour des tests : ajouter des cas dédiés `collectListBlock` / `collectScalarBlock` (edge cases : bloc vide, `|-` vs `>-`, indentation variable).

---

### Note architecturale — Glob quoting dans `serializeFrontmatter`

L'audit suggérait de déplacer `s.includes("*") || s.includes("?") || s.startsWith("{")` hors de `frontmatter.ts`. Décision : **le garder en place**.

Raison : `serializeFrontmatter` est un serializer YAML généraliste. Les patterns glob (`**/*.ts`, `{src,test}/**`) sont syntaxiquement ambigus en YAML — un parser YAML pourrait les mal interpréter sans les guillemets. Ce quoting est une contrainte de sérialisation, pas une règle métier tool-spécifique. Le serializer est l'endroit correct pour cette connaissance.

---

## Critères de succès

- `ToolConfig` n'a plus de `buildFilePath(section, fileName)` ni `convertFrontmatter(fm, section, relativeFileName?)`
- Aucune méthode optionnelle (`?.`) dans les callsites de `distribution.ts`
- `toolPathToInstalledPath` supprimé de `copilot.ts`
- Aucun `if (section.name === X)` dans les implémentations tool (la logique est naturellement séparée par handler)
- Tous les 355+ tests passent
- Snapshots établis et verts
- `parseYamlLike` : aucune variable d'état partagée, cyclomatic complexity réduite
- `serializeFrontmatter` glob quoting : inchangé, décision documentée

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/domain/models/tool-config.ts` | Nouveaux types + nouvelle interface |
| `src/domain/models/distribution.ts` | Dispatch via handlers |
| `src/domain/tools/claude.ts` | Implémentation nouvelle interface |
| `src/domain/tools/cursor.ts` | Implémentation nouvelle interface |
| `src/domain/tools/copilot.ts` | Implémentation + suppression `toolPathToInstalledPath` |
| `tests/domain/models/distribution.test.ts` | Snapshots + migration appels |
| `tests/domain/tools/claude.test.ts` | Migration appels handlers |
| `tests/domain/tools/cursor.test.ts` | Migration appels handlers |
| `tests/domain/tools/copilot.test.ts` | Migration appels handlers |
| `src/domain/models/frontmatter.ts` | Refactor `parseYamlLike` — index-based, 3 sous-fonctions |
| `tests/domain/models/frontmatter.test.ts` | Cas dédiés `collectListBlock` / `collectScalarBlock` |
