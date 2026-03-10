# Plan — ToolConfig Domain Refactor

**Objective** : Decompose the `ToolConfig` God Interface into handlers per functional subject.
**Constraints** : no shared helper module, full domain clean code, behavior preserved by snapshots.

---

## Context

`ToolConfig` mixes 6 responsibilities and forces an `if (section.name === X)` dispatch in every tool implementation. Each section has its own rules but the interface flattens them into generic methods with optional parameters.

Impacted files: `src/domain/models/tool-config.ts`, `src/domain/models/distribution.ts`, `src/domain/tools/claude.ts`, `src/domain/tools/cursor.ts`, `src/domain/tools/copilot.ts`.

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

## Impact on `distribution.ts`

Before (dispatch via `section` passed to methods):
```ts
const outputPath = toolConfig.buildFilePath(section, relativeFileName);
if (toolConfig.shouldProcess?.(section, frontmatter) === false) continue;
const converted = toolConfig.convertFrontmatter(frontmatter, section, relativeFileName);
```

After (explicit dispatch by subject):
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

Dispatch function in `distribution.ts`:
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

`shouldProcess` is called only when the section is `rules`:
```ts
if (section.name === SECTION_RULES && !toolConfig.rules().shouldProcess(frontmatter)) continue;
```

Config and memoryBank replace:
- `getConfigOutputPath` / `shouldMergeConfig?` → `toolConfig.config().outputPath(name)` / `toolConfig.config().shouldMerge(name)`
- `getMemoryBankOutputPath` / `rewriteMemoryBankContent?` → `toolConfig.memoryBank().outputPath(name)` / `toolConfig.memoryBank().rewriteContent(content, docsDir)`

---

## Copilot Deduplication — `toolPathToInstalledPath`

Current problem: `toolPathToInstalledPath` and the paths returned by `buildFilePath` duplicate the mapping logic.

Solution: define the handlers as named objects BEFORE `rewriteContent`, then use them from `rewriteContent`:

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

`toolPathToInstalledPath` is removed — its logic lives in the relevant handlers.

---

## Extraction phase — scope per tool

The `segment.match(/^(\d+)/)?.[1]` pattern stays inline in the `commands()` handlers of `claude.ts` and `copilot.ts`. No shared module — this is behavior specific to each tool.

---

## Agent frontmatter stripping — per handler

`{ name: fm.name, description: fm.description }` stays in each `agents().convertFrontmatter` — co-located with each tool's logic. No cross-tool extraction.

---

## Implementation steps

### Step 1 — Snapshot tests (safety net)

Add snapshot tests in `tests/domain/models/distribution.test.ts` on the full content of generated files for all 3 tools:

```ts
it("snapshot: Claude agents content", () => {
  const files = generateDistribution(framework, claudeToolConfig, "aidd_docs", contentFiles, stubHasher);
  const agent = files.find(f => f.relativePath.includes("agents/"));
  expect(agent?.content).toMatchSnapshot();
});
// same for rules, commands, skills, config, memoryBank
// same for cursor and copilot
```

Run `vitest --update-snapshots` to establish the baseline.

### Step 2 — New types in `tool-config.ts`

1. Add `SectionHandler`, `CommandsHandler`, `RulesHandler`, `ConfigHandler`, `MemoryBankHandler`
2. Replace the `ToolConfig` interface with the new one
3. Remove the monolithic methods from the old interface
4. Keep `acceptsFile`, `stripToolSuffix`, `VALID_TOOL_IDS`, `ToolId`, the registry

**No changes to tools or distribution.ts yet** — TypeScript will indicate the errors to resolve in steps 3 and 4.

### Step 3 — Refactor `distribution.ts`

Replace calls to the old monolithic methods with handler dispatches.
No observable behavior change — snapshots must still pass.

### Step 4 — Refactor `claude.ts`

Restructure `claudeToolConfig` by implementing the new interface:

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

Verify the snapshots still pass.

### Step 5 — Refactor `cursor.ts`

Same structure. Cursor has no `rewriteMemoryBankContent` or `shouldProcess` — implementations return explicit default values:
- `rules().shouldProcess(fm)` → `true` (cursor accepts all rules)
- `memoryBank().rewriteContent` → identical to the global `rewriteContent`

### Step 6 — Refactor `copilot.ts`

1. Define each handler as a named object (`agentsHandler`, `commandsHandler`, `rulesHandler`, `skillsHandler`)
2. Refactor `rewriteContent` to use handlers instead of `toolPathToInstalledPath`
3. Remove `toolPathToInstalledPath`
4. Implement `copilotToolConfig` with the new interface

### Step 7 — Update unit tests for tools

Tests in `tests/domain/tools/` call methods directly. Migrate to:
```ts
claudeToolConfig.agents().buildFilePath("agent.md")
claudeToolConfig.rules().shouldProcess({ paths: ["**/*.ts"] })
// etc.
```

### Step 8 — Final verification

- `pnpm test` — all tests pass
- Snapshots identical (no `--update-snapshots`)
- `pnpm build` — no TypeScript errors
- `pnpm lint` — clean

---

### Step 9 — Refactor `parseYamlLike` (post-ToolConfig)

**Problem** : the function is a state machine with 5 shared mutable variables (`currentKey`, `currentList`, `blockScalarKey`, `blockScalarLines`, `blockScalarFolded`) and 3 interleaved modes. Cyclomatic complexity > 10.

**Solution** : replace the mutable-state loop with an index-based approach, where each parsing mode is a standalone function that explicitly advances the index:

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

Benefits:
- No shared state variables between modes
- Each sub-function is independently testable and readable
- Cyclomatic complexity divided by 3
- `flushBlockScalar()` nested function removed

Test update: add dedicated `collectListBlock` / `collectScalarBlock` cases (edge cases: empty block, `|-` vs `>-`, variable indentation).

---

### Architectural note — Glob quoting in `serializeFrontmatter`

The audit suggested moving `s.includes("*") || s.includes("?") || s.startsWith("{")` out of `frontmatter.ts`. Decision: **keep it in place**.

Reason: `serializeFrontmatter` is a generic YAML serializer. Glob patterns (`**/*.ts`, `{src,test}/**`) are syntactically ambiguous in YAML — a YAML parser could misinterpret them without quotes. This quoting is a serialization constraint, not a tool-specific business rule. The serializer is the correct place for this knowledge.

---

## Success criteria

- `ToolConfig` no longer has `buildFilePath(section, fileName)` or `convertFrontmatter(fm, section, relativeFileName?)`
- No optional method calls (`?.`) in `distribution.ts` callsites
- `toolPathToInstalledPath` removed from `copilot.ts`
- No `if (section.name === X)` in tool implementations (logic is naturally separated by handler)
- All 355+ tests pass
- Snapshots established and green
- `parseYamlLike`: no shared state variables, reduced cyclomatic complexity
- `serializeFrontmatter` glob quoting: unchanged, decision documented

---

## Modified files

| File | Change |
|---|---|
| `src/domain/models/tool-config.ts` | New types + new interface |
| `src/domain/models/distribution.ts` | Dispatch via handlers |
| `src/domain/tools/claude.ts` | New interface implementation |
| `src/domain/tools/cursor.ts` | New interface implementation |
| `src/domain/tools/copilot.ts` | Implementation + removal of `toolPathToInstalledPath` |
| `tests/domain/models/distribution.test.ts` | Snapshots + call migration |
| `tests/domain/tools/claude.test.ts` | Handler call migration |
| `tests/domain/tools/cursor.test.ts` | Handler call migration |
| `tests/domain/tools/copilot.test.ts` | Handler call migration |
| `src/domain/models/frontmatter.ts` | Refactor `parseYamlLike` — index-based, 3 sub-functions |
| `tests/domain/models/frontmatter.test.ts` | Dedicated `collectListBlock` / `collectScalarBlock` cases |
