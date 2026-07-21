---
date: 2026-05-25
scope: MVP1
target_plugin: copilot
spec: ./2026_05_25-framework-build-copilot-spec.md
status: ready-for-implementation
---

# Plan — `aidd framework build --target copilot`

Executable milestone plan for the frozen spec
`aidd_docs/tasks/2026_05/2026_05_25-framework-build-copilot-spec.md`.
Spec is immutable; this plan is the contract for the Implementer and Reviewer.

## 1. Decisions made (M/C/D)

### M-1. Use Claude-format output layout, not Copilot install layout

- **Choice**: Build output stays in Claude format
  (`<out>/plugins/<plugin>/agents/<n>.agent.md`, `skills/<name>/SKILL.md`, `.mcp.json`,
  `hooks/hooks.json`, `.claude-plugin/plugin.json`). No `.github/` rewrite.
- **Rationale**: Spec § "Per-plugin pipeline" item 2 anchors on Copilot manifest
  lookup #4 (Claude-format detection via `.claude-plugin/plugin.json`). Once the
  plugin is detected as Claude format, Copilot expands `${CLAUDE_PLUGIN_ROOT}`
  and keeps file layout. Rewriting to `.github/` would break the contract.
- **Consequence**: `rewriteCopilotContent` in `src/domain/tools/ai/copilot.ts`
  cannot be reused as-is. It converts `@{{TOOLS}}/...` → `.github/<dir>/...`,
  which is install-time semantics, not build-time. **The constraint "reuse
  capability classes in `copilot.ts`" is honored at the seam level only**: the
  build pipeline shares regex-escape and frontmatter parsing helpers, not the
  install rewriter.

### M-2. New rewrite helper lives in `domain/formats/`

- **Choice**: Create `src/domain/formats/relative-link-rewrite.ts` exporting a
  pure function `rewriteRelativeLinks(content: string): string` that converts
  `@./X` → `[X](./X)` and `@../X` → `[X](../X)`. Halt on any `@{{TOOLS}}/...`
  (returns nothing; orchestrator decides — see C-3).
- **Rationale**: The `@./` / `@../` syntax is generic Claude → markdown-link
  translation, not Copilot-specific. Placing it in `formats/` keeps the seam
  reusable by Cursor/OpenCode in MVP2 without touching their `AiTool` configs.
- **Out of scope now**: Hooking this helper into `cursor.ts` / `opencode.ts`.
  Just leave it pure and tested.

### M-3. Build path is Claude-format-preserving copy + targeted transforms

- **Plugin manifest**: copy byte-for-byte (no JSON re-serialize).
- **Agents**: rename `agents/<n>.md` → `agents/<n>.agent.md`; strip frontmatter
  to the allowlist `{ name, description, model, tools, agents, "argument-hint" }`.
- **Skills**: copy tree recursively (`SKILL.md` + every supporting file under
  `skills/<name>/`), then rewrite `@./` and `@../` in every `.md`.
- **Hooks**: copy `hooks/hooks.json` and any sibling files under `hooks/`
  byte-for-byte. Preserve `${CLAUDE_PLUGIN_ROOT}` verbatim (no rewrite).
- **MCP**: copy `.mcp.json` byte-for-byte. Preserve `${CLAUDE_PLUGIN_ROOT}`.
- **Content rewrite scope**: `.md` files only, anywhere under the plugin.

### M-4. Agent FM allowlist is a module constant in domain

- **Choice**: `COPILOT_AGENT_FRONTMATTER_KEYS: readonly string[]` lives next
  to the build-specific stripper (`domain/formats/agent-frontmatter-strip.ts`).
- **Rationale**: spec § Acceptance criteria #6 fixes the set; rule
  `8-value-objects.md` requires named constants for repeated literals.
- **Do not modify** `agentsHandler.convertFrontmatter` in
  `src/domain/tools/ai/copilot.ts` — that path serves install-time and keeps
  only `{name, description}`. Build-time has a different output contract.

### M-5. Marketplace schema must be bundled as an asset

- **Reality check**: `assets/schemas/` ships only
  `claude-code-plugin-manifest.json` today. The spec § Acceptance criteria #3
  requires `marketplace.json` to validate "against the bundled Claude
  marketplace JSON schema (ajv)". The schema must be added to the bundle.
- **Source**: `https://json.schemastore.org/claude-code-marketplace.json` —
  fetch once during Phase 1 prep, commit verbatim under
  `assets/schemas/claude-code-marketplace.json`. Re-fetches are out of scope.
- **Port extension**: `AssetProvider` (`src/domain/ports/asset-provider.ts`)
  gains `loadMarketplaceSchema(): object`. `BundledAssetProviderAdapter`
  (`src/infrastructure/assets/asset-loader.ts`) implements it with the same
  disk-fallback pattern used by `loadPluginManifestSchema`.

### M-6. `marketplace.json` is emitted with stable sorted keys + explicit field sourcing

- **Choice (serialization)**: Build helper serializes via
  `JSON.stringify(obj, sortedKeys, 2) + "\n"`. Each `plugins[]` entry uses the
  same shape and key order: `name`, `version`, `description`, `source`,
  `strict`, `recommended`. Top-level keys: `$schema`, `name`, `version`,
  `description`, `owner`, `plugins`. **Do not reuse**
  `domain/formats/marketplace-json.ts::appendPluginToMarketplace` — it does not
  sort and is append-semantic.
- **Choice (field sourcing for each output `plugins[]` entry)** — resolves
  ambiguity surfaced by the fixture (which omits `version`):
  - `name`: source marketplace entry. Required; must equal the plugin
    directory name. Mismatch → halt with `InvalidSourceMarketplaceError`.
  - `source`: always `./plugins/<name>` (recomputed, never trusted from
    upstream — keeps the dist portable per spec § Marketplace output).
  - `version`: source marketplace entry if present; otherwise read from
    `<plugin>/.claude-plugin/plugin.json` (the manifest the spec asks us to
    bundle). If neither has a `version` → halt with
    `InvalidSourceMarketplaceError`.
  - `description`: source marketplace entry if present; otherwise from the
    plugin manifest. If neither present → emit empty string `""` (schema
    permits it; the schema-validation step in `emitMarketplace` is the final
    gate).
  - `strict`, `recommended`: source marketplace entry only. Default `false`
    when absent (plugin manifests do not carry these fields).
- **Top-level marketplace fields** (`name`, `version`, `description`, `owner`):
  passed through from source marketplace as-is. Schema validation catches
  missing-required-field cases.
- **Rationale**: spec AC #2 ("byte-identical re-runs", "sorted JSON keys")
  plus the spec's own example (which carries a `version: "1.0.0"` not present
  in the fixture's source marketplace, so a fallback rule is mandatory).

### M-7. `<out>` safety guard (bidirectional containment)

- **Choice**: Use-case refuses to run when the resolved absolute `outDir` and
  `sourceDir` are equal, **or** when either is a subpath of the other. Throws
  `FrameworkBuildOutputInsideSourceError` (single error covers both
  directions). Checked **before** the wipe-then-recreate step.
- **Rationale**: Spec § Behavior — "auto-overwrite, no confirmation prompt".
  Phase-3 `execute()` step 2 deletes the entire `outDir`. If `sourceDir` lives
  inside `outDir` (e.g. `--source /work/fw --out /work`), the wipe destroys the
  source. The inverse (`outDir` inside `sourceDir`) is equally fatal — partial
  builds inside the source corrupt the next read.

### M-8. Out-of-scope plugin content (`commands/`, `rules/`) → skip with warn

- **Choice**: When a plugin contains `commands/` or `rules/` subdirectories,
  log `logger.warn("Skipping commands/rules in plugin '<n>' (out of scope for
  MVP1).")` and continue. Do not halt.
- **Rationale**: Spec § Out of scope explicitly mentions this case. Fixture
  `tests/fixtures/framework/plugins/aidd-test/` ships both directories; making
  this halt would force a fixture rewrite without value. `Halt-at-first-failure`
  is reserved for invalid manifests and disallowed placeholders.

### C-3. `@{{TOOLS}}/...` halts the build

- **Choice**: When a `.md` file under a plugin contains `@{{TOOLS}}/`, throw a
  new typed domain error `FrameworkPlaceholderInPluginError` (carrying plugin
  name + file relative path). The orchestrator translates this to halt with
  the original partial output left in place (spec § Behavior).
- **Rationale**: Spec § Per-plugin pipeline step 3, third bullet.

### D-1. CLI command name and registration

- Top-level command: `aidd framework build` (subcommand under a new `framework`
  parent for room to grow). Single subcommand `build` in MVP1.
- File: `src/application/commands/framework.ts`. Registered in `src/cli.ts`
  after `registerSetupCommand`, ordering does not matter beyond TTY menu hooks.
- `framework.ts` exports `registerFrameworkCommand(program: Command): void`.
- Thin wrapper per `.claude/rules/00-architecture/0-command-thin-wrapper.md`:
  parse + validate flags, create deps, call `FrameworkBuildUseCase.execute`,
  print one-line summary, `errorHandler.handle` at action level.

## 2. Rules → files matrix

| Rule (under `.claude/rules/`)                                | Applies to                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00-architecture/0-hexagonal.md`                             | All new files; respect layer boundaries (`domain/` no imports from `application/` or `infrastructure/`).                                                                |
| `00-architecture/0-layer-responsibilities.md`                | `FrameworkBuildUseCase`, build helpers, adapter usage.                                                                                                                  |
| `00-architecture/0-command-thin-wrapper.md`                  | `src/application/commands/framework.ts`.                                                                                                                                |
| `00-architecture/0-tool-config.md`                           | Don't touch `src/domain/tools/ai/copilot.ts` install handlers; new build helpers live in `formats/` not `tools/ai/`.                                                    |
| `00-architecture/0-deps-wiring.md`                           | `src/infrastructure/deps.ts` adds `frameworkBuildUseCase` field.                                                                                                        |
| `00-architecture/0-discriminant-types.md`                    | New build options type lives in `domain/models/framework-build.ts` — never inline.                                                                                      |
| `00-architecture/0-port-design.md`                           | `AssetProvider` extension stays ≤ 5 methods (it goes from 3 → 4).                                                                                                       |
| `00-architecture/0-error-handling.md`                        | Use-case throws typed errors; command catches via `errorHandler.handle`.                                                                                                |
| `01-standards/1-naming.md`                                   | `framework-build-use-case.ts`, `*-adapter.ts`, `*.unit.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts`.                                                              |
| `01-standards/1-exports.md`                                  | Named exports only across new files; no `index.ts`.                                                                                                                     |
| `02-programming-languages/2-typescript.md`                   | All `.ts` files: `.js` ESM extension on imports, `import type`, `readonly` constants.                                                                                   |
| `03-frameworks-and-libraries/3-commander.md`                 | `src/application/commands/framework.ts`.                                                                                                                                |
| `03-frameworks-and-libraries/3-cli-output.md`                | `CLIOutput.success("Built N plugins, M files written to <out>")` on stdout; warns to stderr.                                                                            |
| `04-tooling/4-biome.md`                                      | All new files; run `biome check --write`.                                                                                                                               |
| `05-testing/5-test-pyramid.md`                               | Tests split: unit on pure helpers, integration on use-case, single e2e for AC #4 + AC #1.                                                                               |
| `06-design-patterns/6-use-case.md`                           | `FrameworkBuildUseCase`: class, single `execute`, methods ≤ 20 LOC, typed input/output.                                                                                 |
| `06-design-patterns/6-method-size.md`                        | ≤ 20 LOC every method; extract `buildPlugin`, `buildManifest`, `buildAgents`, `buildSkills`, `buildHooks`, `buildMcp`, `emitMarketplace`.                               |
| `06-design-patterns/6-adapter.md`                            | `BundledAssetProviderAdapter` extension — pure I/O translation, no business logic.                                                                                      |
| `07-quality/7-clean-code.md`                                 | No stubs; named constants for repeated literals (`PLUGIN_MANIFEST_PATH`, `AGENT_EXT`, etc.).                                                                            |
| `08-domain/8-value-objects.md`                               | `FrameworkBuildOptions`, `FrameworkBuildResult`, `BuildPluginResult` in `src/domain/models/framework-build.ts`. All fields `readonly`.                                  |

## 3. Phases

Five phases, each commit-shippable. Conventional commits: phases 1–4 use
`feat(framework): …`; phase 5 uses `test(framework): …`. Final summary commit
optional via `chore(release): …` if a CHANGELOG entry is added — out of scope
of this plan.

---

### Phase 1 — Foundation: pure helpers + bundled schema

**Objective**: Land the reusable, low-risk pieces with zero CLI surface area
changes. Everything in this phase is pure-domain or asset-only, easy to
review, and unlocks all later phases.

**Files touched (create / modify)**:

- `assets/schemas/claude-code-marketplace.json` — **create**. Verbatim copy
  from `https://json.schemastore.org/claude-code-marketplace.json`. Pretty-print
  to stable form (2-space indent, trailing newline). No edits beyond that.
- `src/domain/ports/asset-provider.ts` — **modify**. Add
  `loadMarketplaceSchema(): object;` method to the `AssetProvider` interface.
- `src/infrastructure/assets/asset-loader.ts` — **modify**. Implement
  `loadMarketplaceSchema()` by extending the existing disk-fallback pattern
  (`readSchemaFromDisk`) with a second candidate URL for the new file. Cache
  the schema (`cachedMarketplaceSchema`).
- `src/domain/formats/relative-link-rewrite.ts` — **create**. Pure helper
  `rewriteRelativeLinks(content: string): { content: string }`. Two regex
  replacements: `@./X` → `[X](./X)`, `@../X` → `[X](../X)`. The `X` capture
  matches `[^\s\`'">,]+` (same character class as `copilot.ts::rewriteCopilotContent`).
- `src/domain/formats/agent-frontmatter-strip.ts` — **create**. Pure helper
  exposing `COPILOT_AGENT_FRONTMATTER_KEYS: readonly ["name", "description",
  "model", "tools", "agents", "argument-hint"]` and
  `stripAgentFrontmatter(fm: Record<string, unknown>): Record<string, unknown>`
  — returns a new object containing only keys in the allowlist with
  non-undefined values. Iteration order matches the allowlist constant for
  deterministic re-serialization.
- `src/domain/errors.ts` — **modify**. Add three new typed errors:
  - `FrameworkPlaceholderInPluginError(pluginName, relativePath)` — message:
    `Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin '<name>'
    (file: <path>).`
  - `FrameworkBuildOutputInsideSourceError(sourceDir, outDir)` — message:
    `Refusing to build: --out '<outDir>' and --source '<sourceDir>' must not
    contain each other.` (bidirectional guard per M-7).
  - `InvalidSourceMarketplaceError(detail: string)` — message:
    `Invalid source marketplace: <detail>.` Used by Phase-3 `execute()` step 3
    when the source `marketplace.json` is unreadable, malformed JSON, missing
    `plugins`, or has an entry whose `name` does not match a plugin directory;
    also raised by the `emitMarketplace` field-resolution rules in M-6 when
    `version` is unresolvable.
- `src/domain/models/framework-build.ts` — **create**. Discriminant types and
  value objects (see Phase 2 for shape).

**Test gate** (unit only, no I/O):

- `tests/domain/formats/relative-link-rewrite.unit.test.ts` — describe blocks:
  - "rewrites @./X to [X](./X)" (single, multiple, edge: trailing punctuation,
    URL-like chars stop the match).
  - "rewrites @../X to [X](../X)".
  - "leaves @{{TOOLS}}/... untouched in this helper" (orchestrator handles halt).
  - "leaves ${CLAUDE_PLUGIN_ROOT} untouched" (verifies AC #7 at the unit level).
- `tests/domain/formats/agent-frontmatter-strip.unit.test.ts`:
  - "keeps allowlisted keys".
  - "drops non-allowlisted keys (e.g. `paths`, `tags`)".
  - "drops undefined values".
- `tests/infrastructure/assets/asset-loader.integration.test.ts` — **modify
  or create**: assert `loadMarketplaceSchema()` returns the bundled JSON and is
  memoized across calls.

**Exit criterion**:

- All Phase-1 unit + integration tests green.
- `pnpm build` succeeds; record post-Phase-1 bundle size as baseline in the
  PR description (manual check; not enforced in code).
- Maps to spec ACs: foundation for **#3** (schema), **#5** (link rewrite),
  **#6** (FM strip), **#7** (preserve `${CLAUDE_PLUGIN_ROOT}`).

---

### Phase 2 — Domain models: build options and result

**Objective**: Define the typed input/output contract for the new use-case so
Phase 3 can be implemented against a stable boundary.

**Files touched (create / modify)**:

- `src/domain/models/framework-build.ts` — **finalize** (started in Phase 1).
  - Type `FrameworkBuildTarget = "copilot"`. Single accepted value for MVP1;
    the union widens in MVP2/3 without touching call sites.
  - Interface `FrameworkBuildOptions` (`readonly`):
    `{ sourceDir: string; outDir: string; target: FrameworkBuildTarget }`.
  - Interface `BuildPluginResult` (`readonly`):
    `{ name: string; filesWritten: number; skippedSections: readonly string[] }`.
  - Interface `FrameworkBuildResult` (`readonly`):
    `{ outDir: string; plugins: readonly BuildPluginResult[]; totalFiles: number }`.
  - Module constants:
    - `PLUGIN_MANIFEST_RELATIVE = ".claude-plugin/plugin.json"`.
    - `PLUGIN_HOOKS_RELATIVE = "hooks/hooks.json"`.
    - `PLUGIN_MCP_RELATIVE = ".mcp.json"`.
    - `PLUGIN_AGENT_INPUT_EXT = ".md"`, `PLUGIN_AGENT_OUTPUT_EXT = ".agent.md"`.
    - `OUT_OF_SCOPE_PLUGIN_SECTIONS: readonly ["commands", "rules"]`.

**Test gate**: none beyond TypeScript compilation. These are types and
constants; if Phase 3 compiles, this phase is satisfied.

**Exit criterion**:

- `pnpm typecheck` green.
- Maps to spec ACs: structural foundation for all ACs; no behavior yet.

---

### Phase 3 — Use-case: `FrameworkBuildUseCase`

**Objective**: The orchestrator. Reads source, validates manifests, transforms
each plugin per the spec pipeline, emits `marketplace.json`, returns a typed
result. Throws on first failure (spec § Behavior).

**Files touched (create)**:

- `src/application/use-cases/framework/framework-build-use-case.ts` —
  **create**. Single class `FrameworkBuildUseCase` with one public
  `execute(options: FrameworkBuildOptions): Promise<FrameworkBuildResult>`.

**Use-case shape** (every method ≤ 20 LOC per
`.claude/rules/06-design-patterns/6-method-size.md`):

- `constructor(fs: FileReader & FileWriter, jsonSchemaValidator: JsonSchemaValidator, assetProvider: AssetProvider, logger: Logger)`.
- `execute()`:
  1. Resolve absolute paths; guard via M-7
     (`FrameworkBuildOutputInsideSourceError`).
  2. `readSourceMarketplace()` — read
     `<sourceDir>/.claude-plugin/marketplace.json` through `FileReader`; wrap
     the `JSON.parse` call in `try/catch` and translate `SyntaxError` to
     `InvalidSourceMarketplaceError("malformed JSON: <message>")`. Validate
     the parsed object has a `plugins` array of objects with `name` strings,
     or throw `InvalidSourceMarketplaceError("missing 'plugins' array")`. This
     adapter-style translation lives in the use-case because no new adapter
     is justified for a single file read (`.claude/rules/00-architecture/
     0-error-handling.md` permits use-case-level translation when no adapter
     is in the path).
  3. Wipe `outDir` (spec § Behavior; auto-overwrite). Use `fs.deleteDirectory`
     then `fs.createDirectory`.
  4. For each entry in `sourceMarketplace.plugins` → `buildPlugin(entry)`.
     Validate `entry.name` corresponds to a real directory under
     `<sourceDir>/plugins/`; mismatch → `InvalidSourceMarketplaceError`.
  5. Emit `<outDir>/.claude-plugin/marketplace.json` via
     `emitMarketplace(sourceMarketplace, builtPlugins)`.
  6. Return `{ outDir, plugins, totalFiles }`.
- `buildPlugin(name)` → `BuildPluginResult`:
  1. Resolve `<sourceDir>/plugins/<name>/`.
  2. `validateManifest()` — read `.claude-plugin/plugin.json`, parse, call
     `jsonSchemaValidator.validate(assetProvider.loadPluginManifestSchema(), data)`.
     Schema failure → `JsonSchemaValidationError` propagates (spec AC #8).
  3. `buildManifest()` — write byte-identical copy under
     `<outDir>/plugins/<name>/.claude-plugin/plugin.json`. Increment counter.
  4. `buildAgents()` — for each `agents/<n>.md`: parse frontmatter, strip via
     `stripAgentFrontmatter`, rewrite body via `rewriteRelativeLinks`,
     re-serialize, write under `agents/<n>.agent.md`. (AC #5, #6.)
  5. `buildSkills()` — recursively list `skills/`; for `.md` files apply
     `rewriteRelativeLinks` to content; for other files copy byte-for-byte;
     halt-on-`@{{TOOLS}}/` via `FrameworkPlaceholderInPluginError` (AC #5, C-3).
  6. `buildHooks()` — if `hooks/` exists, copy every file as-is. Verify
     `${CLAUDE_PLUGIN_ROOT}` is preserved by the byte-copy path (AC #7).
  7. `buildMcp()` — if `.mcp.json` exists, copy as-is.
  8. `warnOutOfScopeSections()` — for each name in
     `OUT_OF_SCOPE_PLUGIN_SECTIONS`, if present, `logger.warn(...)` and add to
     `skippedSections`. (M-8.)
  9. Return `BuildPluginResult`.
- `emitMarketplace(plugins, sourceMarketplace)`:
  1. Build object: `$schema`, `name`, `version`, `description`, `owner` from
     source marketplace; `plugins` as the new list with `./plugins/<n>` source
     paths and the fields from M-6.
  2. Validate it against the bundled marketplace schema via
     `assetProvider.loadMarketplaceSchema()`. Throws `JsonSchemaValidationError`
     on failure (AC #3).
  3. Serialize with sorted keys per M-6; write to
     `<outDir>/.claude-plugin/marketplace.json`.

**Files modified**:

- `src/infrastructure/deps.ts` — **modify**. Add `frameworkBuildUseCase` to
  `Deps` interface and the constructor wiring (after `pluginCreateUseCase`).
  Injection order per
  `.claude/rules/06-design-patterns/6-use-case.md` (FileSystem → Validator
  → AssetProvider → Logger). Reuses the existing `assetProvider`,
  `jsonSchemaValidator`, `fs`, and `logger`.

**Test gate** (unit/integration, no CLI):

- `tests/application/use-cases/framework/framework-build-use-case.integration.test.ts`
  using `InMemoryFileAdapter` + `ScriptedPrompter` not needed (no prompter).
  Describe blocks per pipeline step (AC #9 unit-coverage requirement):
  - `describe("manifest validation")` — invalid manifest throws
    `JsonSchemaValidationError` (AC #8).
  - `describe("manifest copy")` — byte-identical content (AC #2, AC #1).
  - `describe("agent rename + frontmatter strip")` — `.md` → `.agent.md`;
    allowlist fields kept, others dropped (AC #6).
  - `describe("skill tree copy")` — nested files preserved; `.md` content
    sees `@./` rewritten (AC #5).
  - `describe("hooks copy")` — `hooks/hooks.json` and any sibling file copied
    verbatim; `${CLAUDE_PLUGIN_ROOT}` preserved (AC #7).
  - `describe("mcp copy")` — `.mcp.json` verbatim; `${CLAUDE_PLUGIN_ROOT}`
    preserved (AC #7).
  - `describe("@{{TOOLS}}/ halts the build")` — throws
    `FrameworkPlaceholderInPluginError`; partial output remains on disk
    (assertion on at least one file present in `outDir`).
  - `describe("out-of-scope sections")` — `commands/`, `rules/` produce a
    `logger.warn` and are listed in `skippedSections`; no halt.
  - `describe("safety guard")` — bidirectional containment throws
    `FrameworkBuildOutputInsideSourceError` (covers both `--out` inside
    `--source` and `--source` inside `--out`).
  - `describe("source marketplace parse")` — malformed JSON, missing
    `plugins` array, and `plugins[].name` not matching a directory all throw
    `InvalidSourceMarketplaceError`.
  - `describe("marketplace field sourcing")` — version pass-through from
    source marketplace; version fallback to plugin manifest; missing version
    everywhere throws `InvalidSourceMarketplaceError`; `strict`/`recommended`
    default to `false` when absent.
  - `describe("marketplace emission")` — keys sorted, schema-validated,
    relative `./plugins/<n>` source paths, trailing newline.
  - `describe("idempotency")` — re-running with identical inputs produces
    byte-identical `outDir`; compute hashes of every file before and after
    (AC #2).

**Exit criterion**:

- Phase-3 integration tests green.
- `pnpm typecheck` green.
- Maps to spec ACs: **#1**, **#2**, **#3**, **#5**, **#6**, **#7**, **#8**, **#9**.

---

### Phase 4 — CLI wiring: `framework build` command

**Objective**: Surface the use-case as `aidd framework build` per the
thin-wrapper rule. No business logic here.

**Files touched (create / modify)**:

- `src/application/commands/framework.ts` — **create**. Exports
  `registerFrameworkCommand(program: Command): void`. Sub-tree:
  ```
  framework
    └── build [--source <path>] [--target copilot] [--out <dir>]
  ```
  All three flags required (spec § Flags). Validation:
  - Required: `--source`, `--target`, `--out`.
  - `--target` only accepts `copilot` in MVP1 → if not `copilot`,
    `output.error("Unsupported target '<v>'. MVP1 supports 'copilot' only.")`
    + `process.exit(1)`. (Stays an `output.error` per
    `.claude/rules/03-frameworks-and-libraries/3-commander.md`.)
  - Resolve `--source` and `--out` to absolute via `path.resolve(projectRoot, ...)`.
  - On success, `output.success("Built <N> plugins, <M> files written to <out>")`
    per spec § Behavior (stats only, no next-step hint).
- `src/cli.ts` — **modify**. `import { registerFrameworkCommand } …` and
  invoke it. Place after `registerSetupCommand(program)` for stable ordering.

**Test gate**: command-level tests are deferred to Phase 5 (e2e); no separate
unit test for the wiring (per
`.claude/rules/05-testing/5-test-pyramid.md` — command files are wiring only).

**Exit criterion**:

- `pnpm build` green.
- `pnpm typecheck` green.
- Manual smoke: `node dist/cli.js framework build --help` shows the new command.
- Maps to spec ACs: **#1** (entry point exists), **#4** prerequisite.

---

### Phase 5 — Tests + fixture top-up + e2e

**Objective**: Close AC #9 and AC #10 with the test pyramid the rule mandates,
and exercise the full install round-trip.

**Files touched (create / modify)**:

- `tests/fixtures/framework/plugins/aidd-test/hooks/hooks.json` — **create** if
  missing. Tiny hook payload exercising `${CLAUDE_PLUGIN_ROOT}` so AC #7 has a
  real fixture: `{ "hooks": { "PreToolUse": [ { "type": "command", "command":
  "${CLAUDE_PLUGIN_ROOT}/scripts/check.sh" } ] } }`. Verify against the
  Copilot/Claude hook format before committing.
- `tests/fixtures/framework/plugins/aidd-test/.mcp.json` — **create** if
  missing. Minimal MCP server entry referencing `${CLAUDE_PLUGIN_ROOT}`.
- `tests/fixtures/framework/plugins/aidd-test/skills/hello.md` — **modify**.
  Append a `@./SKILL.md` reference and a `@../../README.md` reference (or
  equivalent valid relative target) so the build's rewrite path is exercised
  end-to-end without breaking existing tests that read this file.
  - Audit existing tests reading this file (search for `hello.md`) and confirm
    no assertion depends on its exact body. If anything breaks, prefer adding
    a *new* fixture plugin `aidd-build-sample` instead of mutating the
    shared fixture.
- `tests/e2e/framework-build.e2e.test.ts` — **create**. Single e2e file with
  `describe.concurrent("E2E: aidd framework build", () => { … })`. Scenarios
  (one `it` per behaviour sentence, max 5 per
  `.claude/rules/05-testing/5-test-pyramid.md`):
  1. **AC #1 + #4**: `framework build --target copilot --out <tmp>` then
     `marketplace add aidd-test <tmp> --yes` then
     `plugin install aidd-test --tool copilot` (the fixture plugin is named
     `aidd-test`; the spec example's `aidd-dev` was illustrative only).
     Asserts `exitCode === 0` for each and that the install left the expected
     files on disk.
  2. **AC #2**: run `framework build` twice with the same args; recursively
     hash both `outDir` snapshots; assert equal.
  3. **AC #8**: corrupt the source `plugin.json` (missing required `name`);
     run build; expect non-zero exit and `stderr` containing the typed error.
  4. **AC #5 + AC #6**: after build, read `<outDir>/plugins/aidd-test/agents/
     code-reviewer.agent.md` and assert (a) file exists at the new path, (b)
     frontmatter is restricted to the allowlist, (c) a known `@./` reference
     in a skill file has been rewritten to `[X](./X)`.
  5. **AC #7**: read `<outDir>/plugins/aidd-test/hooks/hooks.json` and
     `<outDir>/plugins/aidd-test/.mcp.json`; assert literal substring
     `${CLAUDE_PLUGIN_ROOT}` is preserved.

**Test gate**:

- `pnpm test:unit` green.
- `pnpm test:integration` green.
- `pnpm test:e2e` green.
- `pnpm build` green (bundle within 500 KB budget; measured via
  `scripts/check-bundle-size.mjs`, **not** `check-bundle.cjs` — the task
  prompt referenced an older name).
- `pnpm typecheck` green.
- `pnpm lint` green.

**Exit criterion**:

- Maps to spec ACs: **#9** (unit-per-step coverage via Phase 3), **#10**
  (integration + e2e), and confirms **#1**, **#2**, **#5**, **#6**, **#7**, **#8**
  end-to-end.

---

## 4. AC → Phase coverage matrix

| AC  | Statement (abbrev.)                                                                  | Phases covering | Validation                                                                |
| --- | ------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------- |
| #1  | `aidd framework build` produces a Copilot-readable tree                              | 3, 4, 5         | e2e scenario 1; integration suite on use-case                             |
| #2  | Re-runs are byte-identical (sorted keys, no timestamps)                              | 1, 3, 5         | e2e scenario 2; M-6 sorted-key emitter                                    |
| #3  | `marketplace.json` validates against bundled schema (ajv)                            | 1, 3            | Phase-3 `describe("marketplace emission")`; AssetProvider integration     |
| #4  | `marketplace add` + `plugin install --tool copilot` succeeds against fresh tmp      | 5               | e2e scenario 1                                                            |
| #5  | `@./X` / `@../X` rewritten everywhere under skills                                   | 1, 3, 5         | Unit on helper; integration on `buildSkills`; e2e scenario 4              |
| #6  | Agents renamed `.agent.md` + frontmatter restricted to allowlist                     | 1, 3, 5         | Unit on stripper; integration on `buildAgents`; e2e scenario 4            |
| #7  | `${CLAUDE_PLUGIN_ROOT}` preserved verbatim in hooks/mcp                              | 3, 5            | Integration on `buildHooks`/`buildMcp`; e2e scenario 5                    |
| #8  | Invalid manifest halts with `JsonSchemaValidationError`                              | 3, 5            | Integration on `validateManifest`; e2e scenario 3                         |
| #9  | Unit tests cover every pipeline step                                                 | 1, 3            | All Phase-3 `describe` blocks (≥ 1 per pipeline step)                     |
| #10 | One integration test drives the full build + e2e install                             | 3, 5            | Phase-3 integration suite; e2e scenario 1                                 |

## 5. Reuse inventory (validated against the codebase)

| Existing building block                                                       | Used by build pipeline?                                                | Notes                                                                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/formats/markdown.ts::parseFrontmatter` + `serializeFrontmatter`   | **YES** in `buildAgents` and (read-only) in `buildSkills`              | Stable; covers the YAML subset already used by every other tool                                                                       |
| `src/domain/tools/ai/copilot.ts::rewriteCopilotContent`                       | **NO**                                                                 | Install-time `.github/`-prefix rewriter; conflicts with build-time Claude-format layout (M-1). Do not invoke from the use-case        |
| `src/domain/tools/ai/copilot.ts::agentsHandler.convertFrontmatter`            | **NO**                                                                 | Too narrow (M-4); kept untouched for install path                                                                                      |
| `src/domain/capabilities/marketplace-entry.ts::buildClaudeStyleMarketplaceEntry` | **NO**                                                                | Builds Copilot `extraKnownMarketplaces` install-time entries, not source-marketplace catalog entries. Different schema                |
| `src/domain/formats/marketplace-json.ts::appendPluginToMarketplace`          | **NO**                                                                 | Append-semantic, not sorted (M-6)                                                                                                       |
| `src/infrastructure/adapters/ajv-schema-validator-adapter.ts`                 | **YES** (via `JsonSchemaValidator` port)                               | Already wired in `deps.ts`                                                                                                              |
| `src/infrastructure/assets/asset-loader.ts::BundledAssetProviderAdapter`     | **YES**, extended                                                      | Add `loadMarketplaceSchema()` (Phase 1)                                                                                                |
| `src/infrastructure/adapters/file-adapter.ts` (FileReader/Writer)             | **YES**                                                                | `writeFile`, `readFile`, `listFilesRecursive`, `deleteDirectory`, `createDirectory`, `fileExists`. All present                          |
| `src/application/output.ts::CLIOutput`                                        | **YES** (in command)                                                   | `output.success()` for the spec-mandated stdout summary; `output.warn()` from the use-case logger                                      |
| `src/application/error-handler.ts::ErrorHandler`                              | **YES** (in command)                                                   | Already standard for thin-wrapper commands                                                                                              |

## 6. Risks + mitigations

| Risk                                                                            | Likelihood | Impact | Mitigation                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bundle budget regression (extra schema asset + new use-case)                    | Medium     | Medium | Record post-Phase-1 baseline in PR description; if the marketplace schema is unexpectedly large (>50 KB), keep it lazy-loaded from disk like the manifest schema (same pattern in `BundledAssetProviderAdapter`). |
| Marketplace schema upstream change between fetch and ship                       | Low        | Low    | Pin the version: copy verbatim once and commit; add a comment header in the file noting the fetch date.                                                                                                              |
| Fixture mutation breaks existing tests reading `aidd-test/skills/hello.md`     | Medium     | Low    | Audit references; if mutation is risky, introduce a new `aidd-build-sample` plugin under `tests/fixtures/framework/plugins/`. Cheaper than rewriting the existing fixture.                                            |
| `@./` rewrite is over-eager and rewrites unintended substrings (e.g. inside fenced code blocks) | Medium     | Medium | Capture-class scoped to non-whitespace, non-quote, non-bracket chars (matches `copilot.ts` style); unit tests explicitly cover URL-like neighbours and trailing punctuation.                                          |
| Spec ambiguity: `marketplace.json` field order is "sorted" but plugin entry keys are listed in a specific order in the example | Medium     | Low    | M-6 freezes top-level order (`$schema`, `name`, `version`, `description`, `owner`, `plugins`) and plugin-entry order (`name`, `version`, `description`, `source`, `strict`, `recommended`). Idempotency relies on this; document it inline in the emitter. |
| Hexagonal layering violation: tempted to import `copilot.ts` rewriter from the use-case | Low      | Medium | Build path explicitly forbids it (M-1). Phase 3 review checklist: grep the use-case file for `from "../../domain/tools/ai/copilot.js"` — must return nothing. |
| Method-size creep on `FrameworkBuildUseCase.execute` and `buildPlugin`         | Medium     | Low    | Split per pipeline step (`buildManifest`, `buildAgents`, `buildSkills`, `buildHooks`, `buildMcp`, `warnOutOfScopeSections`, `emitMarketplace`). Linter does not enforce method size, so it surfaces only in review. |
| Concurrent e2e test collisions if AC #4 round-trip leaves state                 | Low        | Low    | All e2e scenarios use `createTestEnv()` (per `tests/e2e/helpers.ts`), which scopes `HOME` and `tempDir`. Reuse exclusively.                                                                                          |

## 7. Out-of-scope reminders (mirroring spec § Out of scope)

- Targets other than `copilot`. The `FrameworkBuildTarget` union is single-valued
  on purpose; widening it is MVP2 work.
- Bundled `commands/` or `rules/` translation. Currently warn + skip (M-8).
- GitHub Action workflow wrapping the CLI. MVP2.
- Tarball-as-marketplace-source. MVP3.
- Hooking the shared rewrite helper into `cursor.ts` / `opencode.ts`. MVP2.

## 8. Definition of done

- All five phases land as ≥ 5 atomic commits with conventional-commit
  messages, mergeable in order.
- `pnpm build && pnpm test && pnpm lint && pnpm typecheck` green.
- Bundle size under 500 KB (`scripts/check-bundle-size.mjs`).
- Every AC has at least one explicit assertion mapped to it (table § 4).
- No code touches `src/domain/tools/ai/copilot.ts` (M-1, M-4).
- New ports/methods documented inline; no `// TODO` markers left in.
