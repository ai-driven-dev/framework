# Plan — Fix distribution output to match example_dist 3.3.2

Analysis source: comparison of `aidd install --all --release v3.3.2` vs `example_dist/aidd-{tool}-3.3.2/`.

> Note on [9]: the path `@.claude/commands/aidd/03/` is CORRECT (commands are indeed installed there). The regex in `claude.ts` is correct. The example_dist has outdated paths in agents. Fix in example_dist, not in the CLI.

---

## Step 1 — `serializeFrontmatter` : string quoting

**File** : `src/domain/models/frontmatter.ts`

**Problem** : String values are not quoted.
- Generated: `name: iris`
- Expected: `name: 'iris'`

**Fix** : In `serializeFrontmatter`, wrap strings in single quotes.
- `string` case → `${key}: '${value}'`
- `boolean` case → unchanged
- array case → unchanged

**Note** : Do not double-quote strings that already contain quotes (handle escaping if necessary).

---

## Step 2 — `.gitkeep` : forced empty content

**File** : `src/domain/models/distribution.ts`

**Problem** : `.gitkeep` files in `rules/` inherit unwanted frontmatter.
- Claude generates `---` (source body)
- Cursor generates `---\nalwaysApply: true\n---\n`
- Expected: empty file

**Fix** : In `generateDistribution`, right after `buildFilePath`, add:
```ts
if (relativeFileName.endsWith(GITKEEP_FILE)) {
  results.push(new GeneratedFile({ relativePath: outputPath, content: "", hash: hasher.hash("") }));
  continue;
}
```

---

## Step 3 — Agents : strip extra fields

**Files** : `src/domain/tools/claude.ts`, `cursor.ts`, `copilot.ts`

**Problem** : All source frontmatter fields are preserved (`color`, `model`, `docs`, `argument-hint`...).
- Expected: only `name` and `description`

**Fix** : In each tool's `convertFrontmatter`, for `SECTION_AGENTS`:
```ts
if (section.name === SECTION_AGENTS) {
  return { name: frontmatter.name, description: frontmatter.description };
}
```

Add **before** the rules block in each tool.

---

## Step 4 — Claude rules : `paths: []` generates empty frontmatter

**File** : `src/domain/tools/claude.ts`

**Problem** : Rules without paths generate `---\npaths:\n---\n`.
- Expected: no frontmatter at all

**Fix** : In claude's `convertFrontmatter` for `SECTION_RULES`:
```ts
if ("paths" in frontmatter) {
  const paths = frontmatter.paths;
  if (Array.isArray(paths) && paths.length === 0) return {};
  return { paths };
}
```

---

## Step 5 — `ToolConfig` interface : pass `relativeFileName` to `convertFrontmatter`

**Files** : `src/domain/models/tool-config.ts`, `src/domain/models/distribution.ts`

**Problem** : To prefix command names (`aidd:01:name`, `aidd_01_name`), `convertFrontmatter` needs the relative path of the source file (e.g. `01_onboard/generate_agent.md`).

**Fix** :
1. Update the `ToolConfig` interface:
```ts
convertFrontmatter(fm: Record<string, unknown>, section: ContentSection, relativeFileName?: string): Record<string, unknown>;
```
2. In `generateDistribution`, pass `relativeFileName`:
```ts
const convertedFrontmatter = toolConfig.convertFrontmatter(frontmatter, section, relativeFileName);
```

---

## Step 6 — Claude commands : prefixed name `aidd:{phase}:{name}`

**File** : `src/domain/tools/claude.ts`

**Problem** : `name: generate_agent` instead of `name: 'aidd:01:generate_agent'`

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

## Step 7 — Copilot commands : prefixed name `aidd_{phase}_{name}`

**File** : `src/domain/tools/copilot.ts`

**Problem** : `name: generate_agent` instead of `name: 'aidd_01_generate_agent'`

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

## Step 8 — Cursor : rule references converted to `.mdc`

**File** : `src/domain/tools/cursor.ts`

**Problem** : `@.cursor/rules/04-tooling/ide-mapping.md` instead of `ide-mapping.mdc`

**Fix** : In cursor's `rewriteContent`, after existing replacements, add:
```ts
.replace(/(@\.cursor\/rules\/[^\s]+)\.md\b/g, "$1.mdc")
```

---

## Step 9 — `{{DOCS}}` / `{{TOOLS}}` not replaced in docs

**File** : `src/application/use-cases/init-use-case.ts`

**Problem** : `aidd_docs/` files contain unreplaced `{{DOCS}}/` and `{{TOOLS}}/`.
- Expected: `aidd_docs/templates/...`
- Generated: `{{DOCS}}/templates/...`

In the docs context, both placeholders map to `docsDir` (docs are not tool-specific).

**Fix** : In the docs copy loop, replace before writing:
```ts
const rewritten = content
  .replaceAll("{{DOCS}}/", `${resolvedDocsDir}/`)
  .replaceAll("{{TOOLS}}/", `${resolvedDocsDir}/`);
await this.fs.writeFile(outputPath, rewritten);
```
Et utiliser `rewritten` pour le hash.

---

## Step 10 — Copilot memory bank : title `# Copilot Instructions`

**File** : `src/domain/tools/copilot.ts`

**Problem** : The title remains `# AGENTS.md` instead of `# Copilot Instructions`

**Fix** : In `rewriteMemoryBankContent`, replace the title at the top of the file:
```ts
return body
  .replace(/^#\s+AGENTS\.md\s*\n/, "# Copilot Instructions\n")
  .replace(new RegExp(`\\]\\(${docsDir}/`, "g"), `](../${docsDir}/`);
```

---

## Step 11 — Copilot : link format `@{{DOCS}}/` and `@{{TOOLS}}/`

**File** : `src/domain/tools/copilot.ts`

**Problem** :
- `@{{DOCS}}/templates/aidd/agent.md` → `[agent.md](aidd_docs/templates/aidd/agent.md)` (generated)
- Expected: `[aidd_docs/templates/aidd/agent.md](../../aidd_docs/templates/aidd/agent.md)`

**Fix** : In `rewriteCopilotContent`:
```ts
// AT_DOCS_PLACEHOLDER
.replace(/`@\{\{DOCS\}\}\/([\S]+?)`/g, (_m, path) => `[\`${docsDir}/${path}\`](../../${docsDir}/${path})`)
.replace(/@\{\{DOCS\}\}\/([\S]+)/g, (_m, path) => `[${docsDir}/${path}](../../${docsDir}/${path})`)
// AT_TOOLS_PLACEHOLDER — convert to installed copilot path
.replace(/@\{\{TOOLS\}\}\/rules\/([\S]+?)\.md\b/g, (_m, p) => {
  const installedPath = `.github/instructions/${flattenFileName(p + ".md", ".instructions.md", { stripNumericPrefix: true })}`;
  return `[${installedPath}](../../${installedPath})`;
})
```

**Note** : handle the backtick-wrapped case to avoid breaking markdown.

---

## Step 12 — Copilot : globs in rule frontmatter (`rules/` → `instructions/`)

**File** : `src/domain/tools/copilot.ts`

**Problem** : The glob `{{TOOLS}}/rules/**/*.md` becomes `.github/rules/**/*.md` after a simple replacement.
- Expected: `.github/instructions/**/*.md`

**Fix** : In copilot's `rewriteContent`, add directional replacements before the generic `TOOLS_PLACEHOLDER` replacement:
```ts
.replaceAll("{{TOOLS}}/rules/", `.github/instructions/`)
.replaceAll("{{TOOLS}}/commands/", `.github/prompts/`)
.replaceAll("{{TOOLS}}/agents/", `.github/agents/`)
.replaceAll("{{TOOLS}}/skills/", `.github/skills/`)
.replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)  // fallback pour le reste
```

---

## Execution order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

After each step: `pnpm test` to check for regressions.

## Validation finale

```bash
rm -rf /tmp/aidd-test && mkdir /tmp/aidd-test
node dist/cli.js install --all --release v3.3.2 --repo ai-driven-dev/aidd-framework
# Comparer avec example_dist outil par outil
```
