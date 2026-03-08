# Plan — Fix distribution output to match example_dist 3.3.2

Source d'analyse : comparaison `aidd install --all --release v3.3.2` vs `example_dist/aidd-{tool}-3.3.2/`.

> Note sur [9] : le chemin `@.claude/commands/aidd/03/` est CORRECT (les commandes sont bien installées là). La regex dans `claude.ts` est juste. L'example_dist a des anciens chemins dans les agents (outdated). À corriger dans example_dist, pas dans la CLI.

---

## Étape 1 — `serializeFrontmatter` : quoting des strings

**Fichier** : `src/domain/models/frontmatter.ts`

**Problème** : Les valeurs string ne sont pas quotées.
- Généré : `name: iris`
- Attendu : `name: 'iris'`

**Fix** : Dans `serializeFrontmatter`, entourer les strings de guillemets simples.
- Cas `string` → `${key}: '${value}'`
- Cas `boolean` → inchangé
- Cas array → inchangé

**Attention** : Ne pas double-quoter les strings qui contiennent déjà des guillemets (gérer l'échappement si nécessaire).

---

## Étape 2 — `.gitkeep` : contenu vide forcé

**Fichier** : `src/domain/models/distribution.ts`

**Problème** : Les fichiers `.gitkeep` dans `rules/` héritent de frontmatter indésirable.
- Claude génère `---` (body du source)
- Cursor génère `---\nalwaysApply: true\n---\n`
- Attendu : fichier vide

**Fix** : Dans `generateDistribution`, juste après `buildFilePath`, ajouter :
```ts
if (relativeFileName.endsWith(GITKEEP_FILE)) {
  results.push(new GeneratedFile({ relativePath: outputPath, content: "", hash: hasher.hash("") }));
  continue;
}
```

---

## Étape 3 — Agents : strip des champs extra

**Fichiers** : `src/domain/tools/claude.ts`, `cursor.ts`, `copilot.ts`

**Problème** : Tous les champs du frontmatter source sont conservés (`color`, `model`, `docs`, `argument-hint`…).
- Attendu : uniquement `name` et `description`

**Fix** : Dans `convertFrontmatter` de chaque tool, pour `SECTION_AGENTS` :
```ts
if (section.name === SECTION_AGENTS) {
  return { name: frontmatter.name, description: frontmatter.description };
}
```

Ajouter **avant** le bloc rules dans chaque tool.

---

## Étape 4 — Claude rules : `paths: []` génère frontmatter vide

**Fichier** : `src/domain/tools/claude.ts`

**Problème** : Les rules sans paths génèrent `---\npaths:\n---\n`.
- Attendu : pas de frontmatter du tout

**Fix** : Dans `convertFrontmatter` claude pour `SECTION_RULES` :
```ts
if ("paths" in frontmatter) {
  const paths = frontmatter.paths;
  if (Array.isArray(paths) && paths.length === 0) return {};
  return { paths };
}
```

---

## Étape 5 — `ToolConfig` interface : passer `relativeFileName` à `convertFrontmatter`

**Fichiers** : `src/domain/models/tool-config.ts`, `src/domain/models/distribution.ts`

**Problème** : Pour préfixer les noms de commandes (`aidd:01:name`, `aidd_01_name`), `convertFrontmatter` a besoin du chemin relatif du fichier source (ex: `01_onboard/generate_agent.md`).

**Fix** :
1. Modifier l'interface `ToolConfig` :
```ts
convertFrontmatter(fm: Record<string, unknown>, section: ContentSection, relativeFileName?: string): Record<string, unknown>;
```
2. Dans `generateDistribution`, passer `relativeFileName` :
```ts
const convertedFrontmatter = toolConfig.convertFrontmatter(frontmatter, section, relativeFileName);
```

---

## Étape 6 — Claude commands : nom préfixé `aidd:{phase}:{name}`

**Fichier** : `src/domain/tools/claude.ts`

**Problème** : `name: generate_agent` au lieu de `name: 'aidd:01:generate_agent'`

**Fix** : Dans `convertFrontmatter` pour `SECTION_COMMANDS` :
```ts
if (section.name === SECTION_COMMANDS && relativeFileName) {
  const phase = relativeFileName.split("/")[0]?.match(/^(\d+)/)?.[1];
  const baseName = String(frontmatter.name ?? "");
  const name = phase ? `aidd:${phase}:${baseName}` : baseName;
  return { name, description: frontmatter.description };
}
```

---

## Étape 7 — Copilot commands : nom préfixé `aidd_{phase}_{name}`

**Fichier** : `src/domain/tools/copilot.ts`

**Problème** : `name: generate_agent` au lieu de `name: 'aidd_01_generate_agent'`

**Fix** : Dans `convertFrontmatter` pour `SECTION_COMMANDS` :
```ts
if (section.name === SECTION_COMMANDS && relativeFileName) {
  const phase = relativeFileName.split("/")[0]?.match(/^(\d+)/)?.[1];
  const baseName = String(frontmatter.name ?? "");
  const name = phase ? `aidd_${phase}_${baseName}` : baseName;
  return { name, description: frontmatter.description };
}
```

---

## Étape 8 — Cursor : références rules converties en `.mdc`

**Fichier** : `src/domain/tools/cursor.ts`

**Problème** : `@.cursor/rules/04-tooling/ide-mapping.md` au lieu de `ide-mapping.mdc`

**Fix** : Dans `rewriteContent` cursor, après les replacements existants, ajouter :
```ts
.replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc")
```

---

## Étape 9 — `{{DOCS}}` / `{{TOOLS}}` non remplacés dans les docs

**Fichier** : `src/application/use-cases/init-use-case.ts`

**Problème** : Les fichiers `aidd_docs/` contiennent `{{DOCS}}/` et `{{TOOLS}}/` non remplacés.
- Attendu : `aidd_docs/templates/...`
- Généré : `{{DOCS}}/templates/...`

Dans le contexte docs, les deux placeholders mappent vers le `docsDir` (les docs ne sont pas tool-specific).

**Fix** : Dans la boucle de copie des docs, remplacer avant d'écrire :
```ts
const rewritten = content
  .replaceAll("{{DOCS}}/", `${resolvedDocsDir}/`)
  .replaceAll("{{TOOLS}}/", `${resolvedDocsDir}/`);
await this.fs.writeFile(outputPath, rewritten);
```
Et utiliser `rewritten` pour le hash.

---

## Étape 10 — Copilot memory bank : titre `# Copilot Instructions`

**Fichier** : `src/domain/tools/copilot.ts`

**Problème** : Le titre reste `# AGENTS.md` au lieu de `# Copilot Instructions`

**Fix** : Dans `rewriteMemoryBankContent`, remplacer le titre en tête de fichier :
```ts
return body
  .replace(/^#\s+AGENTS\.md\s*\n/, "# Copilot Instructions\n")
  .replace(new RegExp(`\\]\\(${docsDir}/`, "g"), `](../${docsDir}/`);
```

---

## Étape 11 — Copilot : format des liens `@{{DOCS}}/` et `@{{TOOLS}}/`

**Fichier** : `src/domain/tools/copilot.ts`

**Problème** :
- `@{{DOCS}}/templates/aidd/agent.md` → `[agent.md](aidd_docs/templates/aidd/agent.md)` (généré)
- Attendu : `[aidd_docs/templates/aidd/agent.md](../../aidd_docs/templates/aidd/agent.md)`

**Fix** : Dans `rewriteCopilotContent` :
```ts
// AT_DOCS_PLACEHOLDER
.replace(/`@\{\{DOCS\}\}\/([\S]+?)`/g, (_m, path) => `[\`${docsDir}/${path}\`](../../${docsDir}/${path})`)
.replace(/@\{\{DOCS\}\}\/([\S]+)/g, (_m, path) => `[${docsDir}/${path}](../../${docsDir}/${path})`)
// AT_TOOLS_PLACEHOLDER — convertir vers chemin copilot installé
.replace(/@\{\{TOOLS\}\}\/rules\/([\S]+?)\.md\b/g, (_m, p) => {
  const installedPath = `.github/instructions/${flattenFileName(p + ".md", ".instructions.md", { stripNumericPrefix: true })}`;
  return `[${installedPath}](../../${installedPath})`;
})
```

**Attention** : gérer le cas backtick-entouré pour ne pas casser le markdown.

---

## Étape 12 — Copilot : globs dans frontmatter des rules (`rules/` → `instructions/`)

**Fichier** : `src/domain/tools/copilot.ts`

**Problème** : Le glob `{{TOOLS}}/rules/**/*.md` devient `.github/rules/**/*.md` après replacement simple.
- Attendu : `.github/instructions/**/*.md`

**Fix** : Dans `rewriteContent` copilot, ajouter des replacements directionnels avant le replacement générique `TOOLS_PLACEHOLDER` :
```ts
.replaceAll("{{TOOLS}}/rules/", `.github/instructions/`)
.replaceAll("{{TOOLS}}/commands/", `.github/prompts/`)
.replaceAll("{{TOOLS}}/agents/", `.github/agents/`)
.replaceAll("{{TOOLS}}/skills/", `.github/skills/`)
.replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)  // fallback pour le reste
```

---

## Ordre d'exécution

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

Après chaque étape : `pnpm test` pour vérifier les régressions.

## Validation finale

```bash
rm -rf /tmp/aidd-test && mkdir /tmp/aidd-test
node dist/cli.js install --all --release v3.3.2 --repo ai-driven-dev/aidd-framework
# Comparer avec example_dist outil par outil
```
