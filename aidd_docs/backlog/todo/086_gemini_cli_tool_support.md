---
id: 086
milestone: M10
title: "Gemini CLI tool support — agents, commands (TOML), skills, MCP"
stories: []
points: 13
blockedBy: []
---

## Context

Gemini CLI (lancé par Google en juin 2025, open-source Apache 2.0) est un agent terminal basé sur Gemini 2.5 Pro. Il supporte un système de personnalisation très proche de Claude Code : fichier de contexte `GEMINI.md`, commandes slash custom en TOML, agents, skills `SKILL.md`, et MCP. Le format `SKILL.md` est explicitement conçu pour être cross-compatible avec Claude Code.

L'objectif est d'ajouter `"gemini"` comme outil géré par le CLI, au même titre que `claude`, `cursor`, `copilot` et `opencode`.

### Mapping conceptuel Gemini CLI ↔ AIDD

| Concept AIDD          | Claude Code             | Gemini CLI                               | Différence clé                              |
|-----------------------|-------------------------|------------------------------------------|---------------------------------------------|
| Memory bank           | `CLAUDE.md`             | `GEMINI.md`                              | Nom de fichier seulement                    |
| Agents                | `.claude/agents/*.md`   | `.gemini/agents/*.md`                    | Format identique                            |
| Commands              | `.claude/commands/*.md` | `.gemini/commands/*.toml`                | Format **TOML**, `{{args}}` au lieu de `$ARGUMENTS` |
| Rules                 | `.claude/rules/**/*.md` | `.gemini/rules/*.md` + annotation prose  | Scoping par convention, pas par le tool     |
| Skills                | `.claude/skills/*/SKILL.md` | `.gemini/skills/*/SKILL.md`          | **Format identique** (cross-compatible)     |
| MCP config            | `.mcp.json`             | `.gemini/settings.json` (`mcpServers`)   | JSON mergé dans settings                   |
| Signal dir            | `.claude/commands/`     | `.gemini/commands/`                      | Fichiers `.toml` à la place de `.md`        |

### Particularités Gemini CLI

**Commandes en TOML :**
```toml
# .gemini/commands/aidd/02/brainstorm.toml
prompt = "..."
description = "Interactive brainstorming session to clarify and refine feature requests"
```
Namespacing : `aidd/02/brainstorm.toml` → commande `/aidd:02:brainstorm` (le `:` vient du sous-répertoire, pas du frontmatter).

**MCP dans settings.json :**
```json
{
  "mcpServers": {
    "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] }
  }
}
```

**Rules : convention AIDD, pas natif Gemini.** Gemini CLI n'a pas de système de règles scopées par glob. La convention AIDD pour Gemini : distribuer chaque règle dans `.gemini/rules/*.md` avec le frontmatter `paths:` converti en annotation prose explicite que Gemini 2.5 Pro interprète. Les règles always-apply (sans `paths:`) sont inlinées directement dans `GEMINI.md`.

**Pourquoi pas un skill "toujours chargé" ?** Les skills Gemini sont lazy-loaded — activés à la demande via `activate_skill` quand le modèle détecte une tâche correspondante. Ils ne sont pas toujours actifs. Les règles always-apply doivent aller dans `GEMINI.md` (chargé à chaque session), pas dans un skill.

**Signal detection :** Les fichiers de commandes Gemini sont des `.toml`. La fonction `hasToolSignals` actuelle lit des `.md` — elle doit être étendue pour lire les `.toml` de Gemini et détecter les commandes avec un nom `aidd:XX:*`.

## Scope

1. Ajouter `"gemini"` dans `ToolId` et `VALID_TOOL_IDS`
2. Créer `src/domain/tools/gemini.ts` implémentant `ToolConfig`
3. Générer les commandes en **TOML** (pas Markdown) pour Gemini
4. Convertir `$ARGUMENTS` → `{{args}}` dans `rewriteContent`
5. Mapper `GEMINI.md` comme memory bank (équivalent de `CLAUDE.md`)
6. Mapper `.gemini/settings.json` pour la config MCP (avec merge JSON)
7. Adapter `hasToolSignals` pour lire les `.toml` de Gemini
8. Distribuer les rules dans `.gemini/rules/*.md` avec annotation prose du `paths:` frontmatter
9. Inliner les rules always-apply (sans `paths:`) dans `GEMINI.md` sous une section dédiée
10. Ajouter la détection Gemini dans `aidd adopt` (`.gemini/` → `gemini`)
11. Tests unitaires complets pour `geminiToolConfig`

## Acceptance Criteria

- [ ] `aidd install --tool gemini` installe le framework dans `.gemini/`
- [ ] Les commandes AIDD sont générées en `.toml` avec `prompt` et `description`
- [ ] `$ARGUMENTS` dans les sources est converti en `{{args}}` dans les `.toml`
- [ ] Le namespacing des commandes respecte `aidd/XX/name.toml` → `/aidd:XX:name` dans Gemini CLI
- [ ] `GEMINI.md` est généré à la racine du projet (équivalent de `CLAUDE.md`)
- [ ] Les agents sont déployés dans `.gemini/agents/*.md` avec le bon frontmatter
- [ ] Les skills sont déployés dans `.gemini/skills/*/SKILL.md` (format passthrough identique à Claude)
- [ ] `.gemini/settings.json` reçoit les `mcpServers` (merge JSON si le fichier existe)
- [ ] Les rules scopées (`paths: [...]`) sont distribuées dans `.gemini/rules/*.md` avec une annotation prose en tête de fichier
- [ ] Les rules always-apply (sans frontmatter ou `paths: []` → cas distinct, voir Technical Notes) sont inlinées dans `GEMINI.md` sous `## Rules`
- [ ] `aidd status` liste les fichiers Gemini trackés correctement
- [ ] `aidd doctor` détecte la présence du signal Gemini (`.gemini/commands/` avec des `.toml` AIDD)
- [ ] `aidd adopt` détecte `.gemini/` et propose `gemini` comme outil installé
- [ ] `aidd sync --from claude --to gemini` fonctionne
- [ ] Le `toolSuffix` `.gemini.md` est respecté pour les fichiers spécifiques à l'outil
- [ ] Tests unitaires : `gemini.ts` — agents, commands (TOML output + frontmatter), skills, config, memoryBank, rewriteContent, reverseRewriteContent, detectUserFileSectionKey
- [ ] Tests unitaires : `hasToolSignals` pour Gemini avec fichiers `.toml`

## Technical Notes

### Nouveau ToolId

```typescript
// src/domain/models/tool-config.ts
export type ToolId = "claude" | "cursor" | "copilot" | "opencode" | "gemini";
export const VALID_TOOL_IDS: readonly ToolId[] = ["claude", "cursor", "copilot", "opencode", "gemini"];
```

### Structure de gemini.ts

```typescript
// src/domain/tools/gemini.ts
const DIRECTORY = ".gemini/";
const TOOL_SUFFIX = ".gemini.md";

export const geminiToolConfig: ToolConfig = {
  toolId: "gemini",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  signalDir: ".gemini/commands",
  // ...
};
registerTool(geminiToolConfig);
```

### Conversion Markdown → TOML pour les commandes

Le `CommandsHandler` pour Gemini ne peut pas retourner un fichier `.md` — il doit générer un `.toml`. Le pipeline de génération de fichiers est actuellement pensé pour du texte brut (le contenu est copié as-is après frontmatter strip + rewrite). Il faudra introduire un mécanisme de transformation de format pour la section `commands` de Gemini. Deux approches possibles :

**Option A (recommandée) :** Ajouter un `transformContent(content: string): string` dans `CommandsHandler` (optionnel, identitaire par défaut). Gemini l'implémente pour convertir le corps Markdown en corps TOML et changer l'extension en `.toml`.

**Option B :** Créer un `buildFilePath` qui retourne `.toml` et laisser le pipeline détecter l'extension pour adapter la sérialisation.

L'option A est moins invasive et cohérente avec `ConfigHandler.transformContent` déjà existant.

### Signal detection Gemini

```typescript
// hasToolSignals doit supporter les .toml pour Gemini
// Pattern à détecter dans un .toml : name = "aidd:XX:..."
/^name\s*=\s*["']?aidd[_:]/m.test(content)
```

### Gemini Rules Convention

Gemini CLI n'a pas de système de règles scopées par glob. La convention AIDD utilise le même frontmatter `paths:` que Claude comme source de vérité, et adapte la sortie selon le type de règle.

**3 cas selon le frontmatter source :**

| Frontmatter source | Comportement Claude | Comportement Gemini |
|--------------------|--------------------|--------------------|
| Sans frontmatter | Toujours chargée | Inlinée dans `GEMINI.md` sous `## Always-Apply Rules` |
| `paths: [...]` (non vide) | Chargée si le fichier matche | Distribuée dans `.gemini/rules/*.md` avec annotation prose |
| `paths: []` (vide) | Jamais chargée automatiquement | Ignorée (skip) |

**Format des fichiers `.gemini/rules/*.md` :**

Le frontmatter YAML est supprimé. Le contenu est précédé d'un bloc d'annotation explicite que Gemini 2.5 Pro interprète :

```markdown
<!-- AIDD Rule — apply when working on files matching: src/**/*.ts, tests/**/*.ts -->
> **Applies to:** `src/**/*.ts`, `tests/**/*.ts`
> Apply this rule whenever you read, write, or reason about files matching the patterns above.

# TypeScript

## Imports
...
```

**`convertFrontmatter` pour Gemini rules :** retourne `{}` (pas de frontmatter en sortie — l'annotation est injectée dans le corps par `rewriteContent`).

**`reverseConvertFrontmatter` :** reconstruit `{ paths: [...] }` depuis l'annotation prose (regex sur le commentaire HTML).

**Gestion dans `RulesHandler.buildFilePath` :**
- `paths: []` → retourne `null` (fichier ignoré, pas distribué)
- `paths: [...]` → retourne `.gemini/rules/<normalized-name>.md`
- Pas de frontmatter → retourne `null` (sera inliné dans `GEMINI.md` par le memoryBank handler)

**Agrégation des always-apply rules dans `GEMINI.md` :**

Le template `TEMPLATE_AGENTS_MD` doit inclure une section `## Always-Apply Rules` avec un placeholder que le `memoryBank().rewriteContent()` remplace par le contenu concatené des règles sans frontmatter. C'est un changement de pipeline à valider : aujourd'hui `rewriteContent` est un simple string replace, pas une injection de contenu depuis le filesystem.

> **Decision point :** si l'agrégation dynamique dans `GEMINI.md` est trop invasive pour v1, les always-apply rules peuvent être distribuées comme les scopées (avec annotation `<!-- applies always -->`). À trancher lors de l'implémentation.

**Vérifier si `GEMINI.md` supporte `@include` :** Gemini CLI supporte peut-être la syntaxe `@.gemini/rules/name.md` dans `GEMINI.md` (à confirmer pendant l'implémentation). Si oui, les rules scopées peuvent être référencées depuis `GEMINI.md` avec `@`, ce qui garantit leur chargement sans dépendre du modèle.

### MCP config merge

```typescript
config(): ConfigHandler {
  return {
    outputPath(configName: string): string | null {
      if (configName === CONFIG_MCP) return `${DIRECTORY}settings.json`;
      return null;
    },
    shouldMerge(_configName: string): boolean {
      return true; // settings.json est mergé (comme .vscode/settings.json pour Claude)
    },
    transformContent(configName: string, content: string): string {
      if (configName !== CONFIG_MCP) return content;
      // Wrapper le contenu MCP dans { mcpServers: ... }
      const mcpServers = JSON.parse(content);
      return JSON.stringify({ mcpServers }, null, 2);
    },
  };
},
```

### Memory bank

```typescript
memoryBank(): MemoryBankHandler {
  return {
    outputPath(templateName: string): string | null {
      if (templateName === TEMPLATE_AGENTS_MD) return "GEMINI.md";
      return null;
    },
    rewriteContent(content: string, docsDir: string): string {
      return geminiToolConfig.rewriteContent(content, docsDir);
    },
  };
},
```

### rewriteContent

```typescript
rewriteContent(content: string, docsDir: string): string {
  return baseRewriteContent(content, DIRECTORY, docsDir)
    .replaceAll("$ARGUMENTS", "{{args}}");
},
reverseRewriteContent(content: string, docsDir: string): string {
  return baseReverseRewriteContent(
    content.replaceAll("{{args}}", "$ARGUMENTS"),
    DIRECTORY,
    docsDir
  );
},
```

## Files to Create/Modify

- `src/domain/models/tool-config.ts` — ajouter `"gemini"` à `ToolId` et `VALID_TOOL_IDS`, ajouter `transformContent?` optionnel à `CommandsHandler`, adapter `hasToolSignals` pour `.toml`
- `src/domain/tools/gemini.ts` — créer `geminiToolConfig`
- `src/cli.ts` ou `src/infrastructure/deps.ts` — importer `gemini.ts` pour déclencher `registerTool()`
- `tests/domain/tools/gemini.test.ts` — créer, tests unitaires complets
- `tests/domain/models/tool-config.test.ts` — étendre `hasToolSignals` pour Gemini `.toml`

## Tests

- **Unit `gemini.ts`** :
  - `agents().buildFilePath()` — produit `.gemini/agents/name.md`
  - `commands().buildFilePath()` — produit `.gemini/commands/aidd/02/name.toml`
  - `commands().convertFrontmatter()` — produit `{ name, description }` avec namespacing `aidd:02:name`
  - `rewriteContent()` — `$ARGUMENTS` converti en `{{args}}`, placeholders remplacés
  - `reverseRewriteContent()` — `{{args}}` reconverti en `$ARGUMENTS`
  - `skills().buildFilePath()` — passthrough vers `.gemini/skills/name/SKILL.md`
  - `config().outputPath(CONFIG_MCP)` → `.gemini/settings.json`
  - `config().shouldMerge()` → `true`
  - `memoryBank().outputPath(TEMPLATE_AGENTS_MD)` → `GEMINI.md`
  - `detectUserFileSectionKey()` — agents, commands, skills détectés
  - `rules().buildFilePath()` — `paths: [...]` → `.gemini/rules/name.md`, `paths: []` → `null`, sans frontmatter → `null`
  - `rules().convertFrontmatter()` — retourne `{}` (pas de frontmatter en sortie TOML/MD)
  - `rules().reverseConvertFrontmatter()` — reconstruit `{ paths: [...] }` depuis annotation prose
- **Unit `hasToolSignals`** : fichier `.toml` avec `name = "aidd:02:brainstorm"` → `true`

## Done When

- Tous les critères d'acceptation cochés
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm lint` passes
- `aidd install --tool gemini` produit une installation utilisable dans un projet Gemini CLI réel
