# Code Review — Domain Layer Audit

Audit of the domain layer (`src/domain/`) focused on clean architecture, simplicity, and composition.

- Status: findings only — no code changes
- Confidence: 9/10

## Findings Summary

4 categories of issues: God Interface, Duplication, Global mutable state, Overly complex parsing.

---

## Scoring

### Potentially Unnecessary Elements

- [🟢] **`rewrittenBody` alias** `distribution.ts:44` `const rewrittenBody = body` is a no-op — the variable is assigned but never transformed. Immediately renamed to body. (Remove the alias)
- [🟢] **`escapedRegex`** `copilot.ts:71` Internal utility to escape a regex. Used once for known placeholders — the escaped value is constant, computing it dynamically adds nothing. (Pre-compute as a constant or inline)

### Standards Compliance

- [🟢] Naming conventions ok — camelCase functions, PascalCase classes, UPPER_CASE constants
- [🟡] **`argument-hint` with hyphen** `claude.ts:65, copilot.ts:160` Accessed via `frontmatter["argument-hint"]` because hyphens are not valid in identifiers. The key comes from the source framework (YAML convention). Acceptable but fragile — no strong typing.

### Architecture

#### A1 — `ToolConfig` : God Interface [🔴]

**`src/domain/models/tool-config.ts:6-18`**

The interface mixes 6 distinct responsibilities into a single contract:

| Responsibility | Method |
|---|---|
| Tool identity | `toolId`, `directory`, `toolSuffix` |
| Path par section | `buildFilePath(section, fileName)` |
| Content rewrite | `rewriteContent`, `rewriteMemoryBankContent?` |
| Conversion frontmatter | `convertFrontmatter(fm, section, relativeFileName?)` |
| Filtrage | `shouldProcess?(section, frontmatter)` |
| Config files | `getConfigOutputPath`, `shouldMergeConfig?` |
| Memory bank | `getMemoryBankOutputPath` |

Direct consequence: every method does internal dispatch on `section.name`:

```ts
// In claude.ts, cursor.ts, copilot.ts — always the same pattern
if (section.name === SECTION_AGENTS) { ... }
if (section.name === SECTION_COMMANDS) { ... }
if (section.name !== SECTION_RULES) return frontmatter;
```

Polymorphism is flattened into an imperative if-chain. Each new section type forces a modification in every tool.

**Proposal** : decompose by functional subject.

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

Benefits:
- No more `section.name` branching in implementations
- Each handler is isolated and independently testable
- `shouldProcess` co-located with `rules()` — the only handler that uses it
- `rewriteMemoryBankContent?` becomes optional in its natural context

#### A2 — Optional methods break the contract [🟡]

**`tool-config.ts:14,16,17`**

```ts
shouldMergeConfig?(configName: string): boolean;
shouldProcess?(section: ContentSection, frontmatter: Record<string, unknown>): boolean;
rewriteMemoryBankContent?(content: string, docsDir: string): string;
```

Three optional methods with `?.` in callsites. Their absence has an implicit default value (`false`, `true`, `rewriteContent`). These defaults should be explicit in the interface or a base implementation, not scattered across callsites.

**`distribution.ts:97`** : `const rewrite = toolConfig.rewriteMemoryBankContent ?? toolConfig.rewriteContent;` — ce fallback est du glue code.

#### A3 — `convertFrontmatter` : signature qui grandit [🟡]

**`tool-config.ts:12`**

```ts
convertFrontmatter(fm, section, relativeFileName?): Record<string, unknown>
```

`relativeFileName?` is optional because it is only used for commands (phase number extraction). This is an implementation leak into the interface. With per-subject decomposition, `commands().convertFrontmatter(fm, relativeFileName)` is natural — no optional param.

#### A4 — `toolPathToInstalledPath` duplique `buildFilePath` [🔴]

**`copilot.ts:75-94`**

`toolPathToInstalledPath` and `buildFilePath` implement the same framework path → copilot path mapping logic, but for two different usages (file path vs content reference). They must be kept in sync manually.

```ts
// buildFilePath pour rules:
flattenFileName(fileName, EXT_INSTRUCTIONS, { stripNumericPrefix: true })
// → .github/instructions/01-mermaid.instructions.md

// toolPathToInstalledPath pour rules:
`instructions/${flattenFileName(file, EXT_INSTRUCTIONS, { stripNumericPrefix: true })}`
// → instructions/01-mermaid.instructions.md (sans DIRECTORY prefix)
```

The only difference is the `DIRECTORY` prefix. This duplication is a symptom of `rewriteContent` not being able to call `buildFilePath` because it has no access to the `section`. With per-section handlers, `rules().buildFilePath(fileName)` would be callable directly from `rewriteContent`.

#### A5 — Phase number extraction duplicated [🟡]

**`claude.ts:34`, `claude.ts:61`, `copilot.ts:156`**

The `segment.match(/^(\d+)/)?.[1]` pattern to extract the phase number appears 3 times. An `extractPhase(dirSegment: string): string | undefined` function should exist.

#### A6 — Agent frontmatter stripping identical across all 3 tools [🟡]

**`claude.ts:58`, `cursor.ts:47`, `copilot.ts:153`**

```ts
return { name: frontmatter.name, description: frontmatter.description };
```

Identical line in all 3 tools. Candidate for a shared `agentFrontmatter(fm)` function.

#### A7 — Registre global mutable [🟡]

**`tool-config.ts:36-50`**

```ts
const TOOL_REGISTRY = new Map<ToolId, ToolConfig>();
export function registerTool(config: ToolConfig): void { ... }
```

Side effect on import: each file `claude.ts`, `cursor.ts`, `copilot.ts` calls `registerTool(...)` at the bottom. The registry is a mutable global singleton — impossible to reset between tests without modifying the module.

In practice tests do not need the registry (they import `claudeToolConfig` directly), but it is an architectural fragility if isolation testing is ever needed.

### Code Health

- [🟢] **Tailles de fichiers** — `copilot.ts` 208 lignes (ok), `claude.ts` 96, `cursor.ts` 68. Dans les limites.
- [🟢] **`distribution.ts`** — 131 lines, well split into helper functions.
- [🟡] **`parseYamlLike`** `frontmatter.ts:53-121` — 68 lines with a state machine (blockScalar + list + keyValue). Three interleaved modes with shared variables (`currentKey`, `currentList`, `blockScalarKey`...). Functional but dense. Candidate for splitting: separate `parseBlockScalar`, `parseListItems`.
- [🟡] **`serializeFrontmatter` — glob detection** `frontmatter.ts:39` `s.includes("*") || s.includes("?") || s.startsWith("{")` — glob-specific quoting logic inside the generic serializer. This does not belong in `frontmatter.ts` — it is a concern of `ToolConfig.rules()`.
- [🟢] **Cyclomatic complexity** — acceptable everywhere except `parseYamlLike` (>10 branches)
- [🟢] **Error handling** — throw early, messages explicites, pas de silent failures
- [🟢] **No magic numbers/strings** — all constants named in `framework-descriptor.ts`

### Manque de tests importants

- [🔴] **Snapshot tests absent** — no snapshot test on the full output of `generateDistribution`. Current tests check partial properties (`toContain`, `toBe`). A snapshot on the full content of a generated file would catch any regression.
- [🟡] **`toolPathToInstalledPath` not directly tested** `copilot.ts:75` — only covered indirectly via `rewriteContent`. If the logic diverges from `buildFilePath`, no test catches it.
- [🟡] **`parseYamlLike` block scalars** — the `>-` block was recently added, covered by a single implicit case via SKILL.md. Deserves dedicated tests (edge cases: `|-`, empty block, variable indentation).
- [🟢] **`serializeFrontmatter` round-trip** — no parse → serialize → parse test. Such a test would catch quoting regressions.

---

## Final Review

- **Score**: 7/10 — Functional architecture, correct logic, but `ToolConfig` is a God Interface that generates duplication and implicit coupling between section dispatch and methods.
- **Feedback**: The user's suggestion (decompose by functional subject `agents()`, `commands()`, `rules()`...) is the right direction. It would eliminate if-chains, leaking optional parameters, and the `toolPathToInstalledPath`/`buildFilePath` duplication.
- **Follow-up Actions**:
  1. Add snapshot tests before any refactoring (safety net)
  2. Decompose `ToolConfig` into handlers per functional section
  3. Extract `extractPhase()` and `agentFrontmatter()` as shared helpers
  4. Move glob detection out of `serializeFrontmatter`
  5. Simplify `parseYamlLike` by separating parsing modes
- **Additional Notes**: The refactoring must be secured by snapshots BEFORE any structural change. The observable behavior surface is the output of `generateDistribution` — that is where snapshots must apply.
