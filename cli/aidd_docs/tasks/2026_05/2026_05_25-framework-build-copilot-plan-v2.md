---
date: 2026-05-25
scope: MVP1
target_plugin: copilot
status: ready-for-implementation
kind: delta
spec: ./2026_05_25-framework-build-copilot-spec.md
supersedes: ./2026_05_25-framework-build-copilot-plan.md
branch: feat/framework-build-copilot
---

# Plan v2 (delta) — `aidd framework build --target copilot`

Executable delta plan against the v1 implementation already on
`feat/framework-build-copilot`. Spec v2 is frozen
(`./2026_05_25-framework-build-copilot-spec.md`); v1 plan is referenced for
inventory only and is superseded wherever it conflicts.

This plan rewrites the parts of v1 that produce the **wrong shape** under spec
v2 (Copilot-native layout) and leaves untouched the parts that still apply
(safety guards, source marketplace parsing, `@{{TOOLS}}/` halt, out-of-scope
warn-and-skip, manifest schema validation).

---

## 1. What changed since v1 implementation

v1 produced Claude-format output relying on Copilot's lookup-chain
compatibility. Spec v2 swaps this for the Copilot-native layout empirically
observed in `github/awesome-copilot`.

| Concern                                  | v1 output (current on branch)                                       | v2 output (spec-mandated)                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Marketplace manifest path                | `<out>/.claude-plugin/marketplace.json`                             | `<out>/.github/plugin/marketplace.json`                                                                                                  |
| Plugin manifest path                     | `<out>/plugins/<name>/.claude-plugin/plugin.json`                   | `<out>/plugins/<name>/.github/plugin/plugin.json`                                                                                        |
| Plugin manifest origin                   | Byte-copy from source `.claude-plugin/plugin.json`                  | **Synthesized**: passthrough metadata + conditional `agents`/`skills`/`hooks`/`mcpServers` fields                                        |
| Source `.claude-plugin/plugin.json`      | Copied to output                                                    | Not copied                                                                                                                               |
| Agent file extension                     | Renamed `<n>.md` → `<n>.agent.md`                                   | Kept as `<n>.md` (plain)                                                                                                                 |
| Agent frontmatter allowlist              | `name, description, model, tools, agents, argument-hint`            | Unchanged (still the Copilot allowlist) — strip rule remains                                                                             |
| `@./X` / `@../X` rewrite in `.md`        | `[X](./X)` / `[X](../X)`                                            | Unchanged                                                                                                                                |
| `@${CLAUDE_PLUGIN_ROOT}/<rel>` in `.md`  | Pass-through (left as literal)                                      | **New**: rewrite to a markdown link with a path computed relative to the current `.md` file's plugin-relative location                   |
| `${CLAUDE_PLUGIN_ROOT}` in `hooks.json`  | Preserved verbatim                                                  | **Inverted**: rewrite every string value to `./<rel>` (rooted at plugin root) in `command`, `args[]`, `env.*`                            |
| `${CLAUDE_PLUGIN_ROOT}` in `.mcp.json`   | Preserved verbatim                                                  | **Inverted**: rewrite every string value to `./<rel>` (rooted at plugin root) in `mcpServers.<srv>.command`, `args[]`, `env.*`           |
| `hooks/` sibling files (non-`.json`)     | Byte-copy                                                           | Unchanged (rewrite scoped to `.json` only)                                                                                               |
| Marketplace.json plugin `source`         | `./plugins/<name>` (path under plugin root)                         | Simple-string `<name>` (resolved against `metadata.pluginRoot`)                                                                          |
| Marketplace.json top-level shape         | `{$schema, name, version, description, owner, plugins}`             | `{name, metadata: {description, version, pluginRoot: "./plugins"}, owner, plugins}` — `$schema` dropped                                  |
| Marketplace.json plugin-entry shape      | `{name, version, description, source, strict, recommended}`         | `{name, source, description, version}` — `strict`/`recommended`/`$schema` dropped                                                        |
| Bundled marketplace JSON schema          | `assets/schemas/claude-code-marketplace.json` (schemastore.org)     | **Replaced** with a hand-crafted Copilot-native schema (`copilot-plugin-marketplace.json`) reflecting `metadata.pluginRoot` + string source |
| Marketplace `description` fallback rule  | Empty string when missing                                           | **Inverted**: halt with `InvalidSourceMarketplaceError` if `description` not resolvable (spec §Marketplace output, sentence 2)            |
| `out` safety guard                       | Bidirectional containment check                                     | Unchanged                                                                                                                                |
| `@{{TOOLS}}/...` placeholder halt        | Throws `FrameworkPlaceholderInPluginError`                          | Unchanged                                                                                                                                |
| `commands/` and `rules/` warn-and-skip   | Logs warn, appends to `skippedSections`                             | Unchanged                                                                                                                                |
| Source marketplace parsing               | `InvalidSourceMarketplaceError` on malformed JSON / missing plugins | Unchanged                                                                                                                                |
| Plugin manifest schema validation        | ajv against bundled Claude manifest schema                          | Unchanged (the source plugin.json is still Claude-format; we validate the source then synthesize)                                        |

### Files in v1 that survive nearly intact

- `src/domain/errors.ts` — three typed errors land in v1 already; reused as-is.
- Use-case private methods: `guardPaths`, `readSourceMarketplace`,
  `validateSourceMarketplace`, `assertNoToolsPlaceholder`,
  `warnOutOfScopeSections`, `validateManifest`.
- `stripAgentFrontmatter` + `COPILOT_AGENT_FRONTMATTER_KEYS` — allowlist is
  identical.
- The `@./` / `@../` regex pair inside `rewriteRelativeLinks` — preserved;
  the function gets a third branch (see C-v2.1) and a signature change.
- `BundledAssetProviderAdapter.loadPluginManifestSchema` and its caching path.
- `src/application/commands/framework.ts` — thin wrapper survives untouched
  (still parses `--source`, `--target copilot`, `--out`; still emits the
  one-line success string).

---

## 2. New decisions for v2 (M / C / D)

### M-v2.1. Rewrite the use-case "shape" methods, keep the "guard / parse / orchestrate" skeleton

- **Choice**: rewrite `buildManifest`, `buildAgents`, `buildHooks`, `buildMcp`,
  `emitMarketplace`, `buildMarketplaceObject`,
  `buildMarketplacePluginEntries`, `resolvePluginEntry`. Keep `guardPaths`,
  `readSourceMarketplace`, `validateSourceMarketplace`,
  `assertNoToolsPlaceholder`, `warnOutOfScopeSections`, `validateManifest`,
  `buildPlugin` (its body changes, signature stays).
- **Rationale**: the shape-emission methods all encode the Claude-format
  output that spec v2 inverts. The guard/parse methods read the source
  (still Claude-format) and stay correct.

### M-v2.2. Manifest paths split into input vs output constants

- **Choice** (in `src/domain/models/framework-build.ts`):
  - Rename `PLUGIN_MANIFEST_RELATIVE` → `SOURCE_PLUGIN_MANIFEST_RELATIVE`
    (value unchanged: `".claude-plugin/plugin.json"`).
  - Add `OUTPUT_PLUGIN_MANIFEST_RELATIVE = ".github/plugin/plugin.json"`.
  - Add `SOURCE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json"`
    (replaces the inline `MARKETPLACE_JSON_PATH` const in the use-case).
  - Add `OUTPUT_MARKETPLACE_RELATIVE = ".github/plugin/marketplace.json"`.
  - **Delete** `PLUGIN_AGENT_OUTPUT_EXT` — agents keep their `.md`. Keep
    `PLUGIN_AGENT_INPUT_EXT = ".md"` (still useful as a guard for the agent
    listing).
- **Rationale**: a single `PLUGIN_MANIFEST_RELATIVE` becomes ambiguous when
  the read path and the write path diverge. Naming surfaces the asymmetry.

### M-v2.3. `rewriteRelativeLinks` signature breaks; gains a third rewrite branch

- **Choice**: change the function signature to
  `rewriteRelativeLinks(content: string, options: { currentFilePluginRelative: string }): string`.
  Add a new replacement step for `@${CLAUDE_PLUGIN_ROOT}/<rel>` that produces
  `[<basename>](<relative-to-current-file>)`. Algorithm:
  1. `targetPluginRel = <rel>` (the captured group; everything after `${CLAUDE_PLUGIN_ROOT}/`).
  2. `currentDirPluginRel = path.dirname(currentFilePluginRelative)`.
  3. `linkPath = path.posix.relative(currentDirPluginRel, targetPluginRel)`.
  4. If `linkPath` does not start with `.`, prepend `./`.
  5. `label = path.posix.basename(targetPluginRel)` — matches the existing
     `@./X` → `[X](./X)` convention where `X` is the captured non-whitespace
     run (basename only here keeps labels stable when the path is long).
- **Spec verbatim example check** (spec §"Content rewrite" rule 3): file
  at `skills/09-for-sure/actions/01-init.md` references
  `@${CLAUDE_PLUGIN_ROOT}/skills/09-for-sure/assets/plan-template.md` →
  `[plan-template.md](../assets/plan-template.md)`. Algorithm above produces
  exactly that.
- **Rationale**: rule 3 needs the current file's plugin-relative location to
  compute `path.relative` — a `(content: string)` signature is insufficient.
  Inverting now is cheaper than threading the path later.
- **Backwards compat**: every existing call site in the use-case (currently
  two: `buildAgentFile`, `buildSkillFile`) passes the new option. No external
  caller depends on the function yet.

### M-v2.4. New pure helper: `domain/formats/claude-root-path-rewrite.ts`

- **Choice**: create `src/domain/formats/claude-root-path-rewrite.ts` exporting:
  ```ts
  export function rewriteClaudeRootInJson(parsed: unknown): unknown;
  ```
  Recurses through any value. For each string leaf, replace
  `${CLAUDE_PLUGIN_ROOT}/<rel>` → `./<rel>` everywhere in the string. Other
  values (numbers, booleans, null, arrays, objects) recurse or pass through.
  **Pure** — no I/O, no `path` calls (the rewrite is a literal prefix swap
  because the JSON references are already plugin-root-anchored).
- **Why a single helper for both hooks.json and .mcp.json**: both files use
  `${CLAUDE_PLUGIN_ROOT}` to anchor paths from the plugin root, and both
  need the same prefix swap. The spec restricts which keys carry the
  variable, but a structural recursion is simpler and safer than per-key
  walks; the variable cannot survive in any string leaf after the recursion,
  which is exactly the AC #7 invariant.
- **Caller pattern** (in the use-case):
  ```ts
  const parsed = JSON.parse(raw);
  const rewritten = rewriteClaudeRootInJson(parsed);
  await fs.writeFile(dest, JSON.stringify(rewritten, null, 2) + "\n");
  ```
- **Rationale**: keeps the rewrite testable in isolation; satisfies hex
  layering (pure `formats/` helper, no I/O). Avoids regex on raw bytes (the
  spec demands rewriting *string values*, not text that happens to match the
  pattern inside a comment or a key name).

### M-v2.5. Bundled marketplace schema is replaced (not edited) with a hand-crafted Copilot-native schema

- **Choice**: delete `assets/schemas/claude-code-marketplace.json` (509 lines,
  schemastore.org Claude marketplace schema). Add
  `assets/schemas/copilot-plugin-marketplace.json` — a hand-crafted JSON Schema
  draft-07 file matching the Copilot-native shape:
  - Required at root: `name`, `metadata`, `owner`, `plugins`.
  - `metadata` required: `pluginRoot`. Optional: `description`, `version`.
  - `plugins[].`: required `name`, `source`, `description`, `version`;
    `source` is `type: "string"` (no object form).
  - `$comment` header noting the schema is hand-crafted from the empirical
    `github/awesome-copilot` reference repo on 2026-05-25, with a short list
    of citation files (`/.github/plugin/marketplace.json` and at least one
    plugin example).
- **Rationale**: spec AC #3 says "If no published schema exists, ship a
  hand-crafted minimal schema based on awesome-copilot empirical examples and
  document the source." Empirical schema differs structurally from the
  schemastore Claude marketplace schema (`metadata.pluginRoot` is new;
  `strict`/`recommended` fields don't exist; `source` is simple-string only).
- **Asset wiring**: `BundledAssetProviderAdapter.loadMarketplaceSchema()` keeps
  the same memoized-disk-fallback pattern; only the constant `MARKETPLACE_SCHEMA_FILE`
  changes value from `"claude-code-marketplace.json"` to
  `"copilot-plugin-marketplace.json"`. The port method name stays
  `loadMarketplaceSchema()` (the schema *is* a marketplace schema; the
  Copilot-specific source is encoded in the bundled asset, not the port name).

### M-v2.6. plugin.json synthesis: deterministic field order

- **Choice**: `buildManifest()` emits the synthesized plugin.json with this
  fixed top-level key order:
  `name, description, version, author, homepage, repository, license, keywords,
   agents, skills, hooks, mcpServers`.
  Missing optional fields are omitted entirely (not set to `null`).
  Conditional fields (`agents`, `skills`, `hooks`, `mcpServers`) follow the
  spec §"Field synthesis rules" presence test:
  - `agents`: `"./agents"` (string) iff `<plugin>/agents/` has ≥ 1 `.md` file
    after recursion.
  - `skills`: `["./skills/<name>", …]` (array, sorted alphabetically) iff
    `<plugin>/skills/<name>/SKILL.md` exists for that `<name>`.
  - `hooks`: `"./hooks/hooks.json"` (string) iff `<plugin>/hooks/hooks.json`
    exists.
  - `mcpServers`: `"./.mcp.json"` (string) iff `<plugin>/.mcp.json` exists.
- **Rationale**: idempotency (AC #2) requires byte-identical output across
  runs. Insertion order via `Object.entries` is stable in Node ≥ 12, so a
  hand-built object literal with this exact order serializes deterministically
  under `JSON.stringify(obj, null, 2)`.

### M-v2.7. Marketplace.json synthesis: deterministic field order + new shape

- **Choice**: `emitMarketplace()` produces an object with this fixed
  top-level key order: `name, metadata, owner, plugins`. The `metadata`
  sub-object key order: `description, version, pluginRoot`. Each entry in
  `plugins[]` uses key order: `name, source, description, version`.
- **`source` value**: bare plugin name (`<name>`), no `./plugins/` prefix.
  Resolved against `metadata.pluginRoot = "./plugins"`. The string is
  reconstructed inside the emitter — the source-marketplace entry's `source`
  field is **not** trusted (the source marketplace ships Claude-format
  paths like `"./plugins/aidd-test"`, which would be wrong on output).
- **Field-sourcing rules** (override M-6 from plan v1):
  - `name`: from source marketplace entry. Required; must equal the plugin
    directory name. Mismatch → `InvalidSourceMarketplaceError`.
  - `source`: always `<name>` (recomputed).
  - `description`: source marketplace entry, falling back to the synthesized
    plugin.json description (which itself came from the source plugin.json).
    Spec v2 §"Marketplace output" sentence 2 mandates this fallback; if
    **neither** has a value, halt with `InvalidSourceMarketplaceError`
    (inverted from plan v1's "emit empty string").
  - `version`: source marketplace entry, falling back to the source plugin.json.
    If neither has a value, halt with `InvalidSourceMarketplaceError` (same
    as v1).
- `strict` and `recommended` are **dropped** (Copilot-native shape omits them).

### M-v2.8. `commands/` and `rules/` are still warn-and-skip

- No change from plan v1 / M-8. Spec v2 §"Out of scope (MVP1)" preserves
  this. Re-stating to prevent regression during the rewrite.

### M-v2.9. Source marketplace entry `source` mismatch is tolerated

- **Choice**: when the source marketplace entry has a `source` field
  pointing at e.g. `./plugins/<name>`, ignore it during translation.
  Mismatch between entry `source` and entry `name` does not throw. Only the
  entry `name` is authoritative.
- **Rationale**: the source marketplace is Claude-format on disk
  (the in-repo fixture has `"source": "./plugins/aidd-test"`). Forcing it to
  match a Copilot string would require either pre-translating the fixture
  or adding a redundant Claude-vs-Copilot toggle. Recomputing on output
  keeps the source-fixture invariant.

### C-v2.1. `@${CLAUDE_PLUGIN_ROOT}/X` halts in any non-`.md` content path

- **Choice**: outside `.md` files (i.e. inside `hooks/<sibling>.<ext>`
  non-JSON files), `${CLAUDE_PLUGIN_ROOT}` is left untouched (those files
  copy byte-for-byte per spec §"Hooks"). Inside `.md`, the new rewrite
  branch in M-v2.3 handles it. Inside JSON (hooks.json + .mcp.json),
  M-v2.4 handles it.
- **Rationale**: spec is explicit on the scopes; document the boundary so
  the rewriter is not over-applied to sibling shell scripts.

### C-v2.2. `${CLAUDE_PLUGIN_ROOT}` without leading `@` inside `.md` is left untouched

- **Choice**: explicitly do **not** rewrite bare `${CLAUDE_PLUGIN_ROOT}` text
  inside `.md` files (spec §"Content rewrite", final paragraph).
- **Rationale**: the variable has no semantic meaning in markdown body text
  in either Claude or Copilot — rewriting it would risk corrupting code
  fences or quoted examples. The new `@${CLAUDE_PLUGIN_ROOT}/X` rewrite
  matches only when prefixed with `@` and followed by `/<path>`.

### D-v2.1. Source-side fixtures stay Claude-format; output assertions match Copilot-native

- The framework source is **Claude-format** (this is the input contract).
  Fixtures keep `${CLAUDE_PLUGIN_ROOT}` in `hooks/hooks.json` and `.mcp.json`,
  and the source marketplace keeps its `./plugins/<name>` entry source.
- Output assertions in tests and e2e change to verify Copilot-native shape:
  no `${CLAUDE_PLUGIN_ROOT}` survives in output, plugin.json/marketplace.json
  live under `.github/plugin/`, agents keep their `.md` extension.

### D-v2.2. CLI surface is unchanged

- `framework build` command, three flags, success line. v1 wrapper survives.
  Only the success line wording is unchanged — the count it reports may
  rise (synthesized plugin.json is one file; old marketplace.json path
  changes but is still one file; agents/skills counts unchanged).

### M-v2.10. Rename `FrameworkBuildOutputInsideSourceError` → `InvalidBuildPathsError`

- **Choice**: spec v2 §"Safety guard" (line 158) and AC #10 both name the
  safety-guard error **`InvalidBuildPathsError`**. The v1 code shipped
  `FrameworkBuildOutputInsideSourceError`. Spec is frozen → rename.
- **Files**: `src/domain/errors.ts` (rename the class + `this.name = "InvalidBuildPathsError"`);
  `src/application/use-cases/framework/framework-build-use-case.ts` (import + throw site in
  `guardPaths`); `tests/application/use-cases/framework/framework-build-use-case.integration.test.ts`
  (the three `describe("safety guard")` assertions). One rename, no behavior change.
- **Rationale**: AC #10 verification asserts on the error name verbatim. A
  test pinned to the v1 name would fail under the spec contract.
- **Where in phases**: Phase A (asset/helpers + rename) — the rename is a
  pure-domain change with no behavior impact on the use-case logic.

### D-v2.3. AC #4 fixture plugin name stays `aidd-test`

- Spec AC #4 example uses `aidd-dev`. The in-repo fixture is named
  `aidd-test` (v1 inherited this). Spec line 162 says "follows the layout
  in this spec" — layout is the contract, the plugin name in the example
  is illustrative. e2e tests stay on `aidd-test`. No rename needed.

---

## 3. Decisions surfaced but not blocking

### Spec / empirical disagreement on the `agents` field type

- Spec v2 §"Per-plugin output" sentence-form rule (line 103): emits `agents`
  as `"./agents"` (**string form**).
- Spec v2 §"Empirical confirmations" (line 185): cites
  `github/awesome-copilot/plugins/ai-team-orchestration/.github/plugin/plugin.json`
  using `agents: ["./agents"]` (**array form**).
- Plan follows the spec text (frozen artifact) and emits the string form.
- If implementation surfaces a Copilot warning or rejection at install time,
  flip to the array form via a one-line change in `buildManifest`. Capture
  the verdict in a follow-up decision. **Not blocking the plan**; called out
  so the reviewer / implementer sees it.

This is listed in `decisions_blocked` for visibility even though the plan
makes a conservative choice (follow the frozen spec text).

---

## 4. Files to delete, rewrite, and create

### Delete

- `assets/schemas/claude-code-marketplace.json` — Claude marketplace schema
  (schemastore.org). Replaced by the hand-crafted Copilot-native schema.

### Rewrite

| File                                                                                          | Scope of rewrite                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/application/use-cases/framework/framework-build-use-case.ts`                             | Replace `buildManifest`, `buildAgents`, `buildHooks`, `buildMcp`, `emitMarketplace`, `buildMarketplaceObject`, `buildMarketplacePluginEntries`, `resolvePluginEntry`. New methods: `synthesizePluginManifest`, `detectPluginPresenceFlags`, `rewriteHooksJson`, `rewriteMcpJson`, `emitMarketplaceCopilot`. |
| `src/domain/models/framework-build.ts`                                                        | Rename `PLUGIN_MANIFEST_RELATIVE` → `SOURCE_PLUGIN_MANIFEST_RELATIVE`. Add `OUTPUT_PLUGIN_MANIFEST_RELATIVE`, `SOURCE_MARKETPLACE_RELATIVE`, `OUTPUT_MARKETPLACE_RELATIVE`. Delete `PLUGIN_AGENT_OUTPUT_EXT`. |
| `src/domain/errors.ts`                                                                        | Rename class `FrameworkBuildOutputInsideSourceError` → `InvalidBuildPathsError` (M-v2.10). Update `this.name` accordingly. Message unchanged.                                                                |
| `src/domain/formats/relative-link-rewrite.ts`                                                 | Change signature: `rewriteRelativeLinks(content, { currentFilePluginRelative })`. Add the third branch for `@${CLAUDE_PLUGIN_ROOT}/<rel>` per M-v2.3.             |
| `tests/application/use-cases/framework/framework-build-use-case.integration.test.ts`          | Invert 8 assertions: agent rename → no-rename, hooks/mcp `${CLAUDE_PLUGIN_ROOT}` preservation → rewrite, `./plugins/<name>` source → bare name, manifest output path. Add `describe("plugin manifest synthesis", …)` block. |
| `tests/e2e/framework-build.e2e.test.ts`                                                       | AC #6 path: `code-reviewer.agent.md` → `code-reviewer.md`. AC #7: assert `${CLAUDE_PLUGIN_ROOT}` does **not** appear in hooks/mcp output; assert relative `./scripts/check.sh` style does. Add an AC #9 / Copilot-shape assertion (new layout). |
| `tests/domain/formats/relative-link-rewrite.unit.test.ts`                                     | Add `currentFilePluginRelative` to every existing call (use a stable test value like `"skills/foo/SKILL.md"`). Add a `describe("rewrites @${CLAUDE_PLUGIN_ROOT}/X", …)` block matching the spec example. |
| `tests/infrastructure/assets/asset-loader.unit.test.ts`                                       | Update `describe("BundledAssetProviderAdapter.loadMarketplaceSchema", …)` assertions: `required` no longer contains `version` at the top; verify `metadata` is required; verify the schema id / `$comment` mentions awesome-copilot. |

### Create

| File                                                                                          | Purpose                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assets/schemas/copilot-plugin-marketplace.json`                                              | Hand-crafted Copilot-native marketplace schema. `$comment` header cites the awesome-copilot files used (`/.github/plugin/marketplace.json` and at least one plugin example).                                                                          |
| `src/domain/formats/claude-root-path-rewrite.ts`                                              | Pure helper `rewriteClaudeRootInJson(parsed: unknown): unknown` per M-v2.4.                                                                                                                                                                            |
| `tests/domain/formats/claude-root-path-rewrite.unit.test.ts`                                  | Unit cases: string leaf with `${CLAUDE_PLUGIN_ROOT}/scripts/check.sh` → `./scripts/check.sh`; recursion into arrays (`args[]`); recursion into nested objects (`env.PATH`); string leaves without the variable pass through; non-string leaves untouched. |
| `tests/application/use-cases/framework/plugin-manifest-synthesis.integration.test.ts` (or describe-block extension to the existing integration file) | Synthesis cases per M-v2.6: each conditional field is emitted only when its source artifact exists. Key order is exactly the M-v2.6 list. `$schema` and `strict` are dropped.                                                                          |

### Fixtures

| Path                                                                                          | Action                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/fixtures/framework/plugins/aidd-test/skills/hello.md`                                  | Append a `@${CLAUDE_PLUGIN_ROOT}/skills/aidd-test/commit/SKILL.md` reference. Exercises the new content-rewrite branch end-to-end. Existing `@./SKILL.md` and `@../commit/SKILL.md` lines stay. |
| `tests/fixtures/framework/.claude-plugin/marketplace.json`                                    | **No change** — source stays Claude-format per D-v2.1. The build is the translator.                                                                                                          |
| `tests/fixtures/framework/plugins/aidd-test/hooks/hooks.json`                                 | **No change** — source stays Claude-format. Variable references exercise the rewrite path.                                                                                                   |
| `tests/fixtures/framework/plugins/aidd-test/.mcp.json`                                        | **No change** — source stays Claude-format.                                                                                                                                                  |

---

## 5. Phases (commit-shippable, conventional-commit format)

Five phases. v1's five-phase split does not map cleanly because the surfaces
that change in v2 cut across plan-v1 phases 1/3/5. New shape:

```mermaid
---
title: Plan v2 — phase flow
---
stateDiagram-v2
  direction LR
  Start
  PhaseA["Phase A$ Pure helpers + schema swap"]
  PhaseB["Phase B$ Use-case rewrite (synthesis + paths)"]
  PhaseC["Phase C$ Marketplace emitter rewrite"]
  PhaseD["Phase D$ Test inversion + new fixture"]
  PhaseE["Phase E$ Gate (bundle, lint, typecheck, e2e)"]
  Done
  Start --> PhaseA
  PhaseA --> PhaseB
  PhaseB --> PhaseC
  PhaseC --> PhaseD
  PhaseD --> PhaseE
  PhaseE --> Done
```

Each phase ends with one conventional commit (`feat(framework): …` or
`test(framework): …` for Phase D, `chore(framework): …` for the asset-only
schema swap step inside Phase A if it lands as its own commit).

---

### Phase A — Pure helpers + schema swap

**Objective**: Land every pure-domain change and the asset swap. Zero
behavior change at the use-case level until Phase B picks them up.

**Files touched**:

- `assets/schemas/claude-code-marketplace.json` — **delete**.
- `assets/schemas/copilot-plugin-marketplace.json` — **create**.
- `src/infrastructure/assets/asset-loader.ts` — **modify**: change
  `MARKETPLACE_SCHEMA_FILE` value. Method body unchanged.
- `src/domain/errors.ts` — **modify**: rename
  `FrameworkBuildOutputInsideSourceError` → `InvalidBuildPathsError`
  (M-v2.10).
- `src/domain/formats/relative-link-rewrite.ts` — **rewrite**: new signature
  and new `@${CLAUDE_PLUGIN_ROOT}/<rel>` branch (M-v2.3).
- `src/domain/formats/claude-root-path-rewrite.ts` — **create** (M-v2.4).
- `src/domain/models/framework-build.ts` — **modify**: rename constants,
  delete `PLUGIN_AGENT_OUTPUT_EXT`, add new output-path constants (M-v2.2).
- `tests/domain/formats/relative-link-rewrite.unit.test.ts` — **modify**:
  add `currentFilePluginRelative` to every call; add new describe block.
- `tests/domain/formats/claude-root-path-rewrite.unit.test.ts` — **create**.
- `tests/infrastructure/assets/asset-loader.unit.test.ts` — **modify**:
  assertions on the new schema's `required` and `$comment`.

**Test gate**:

- `pnpm test --filter "domain/formats" --filter "infrastructure/assets"` green.
- `pnpm typecheck` green at the formats/models boundary.

**Exit criterion**:

- All new and modified unit tests in this phase green.
- AC mapping: lays groundwork for **#3** (schema), **#5** + **#7** (rewrite
  helpers ready for the use-case to wire in Phase B).

**Note**: the use-case temporarily fails to typecheck because
`PLUGIN_AGENT_OUTPUT_EXT` is gone and `rewriteRelativeLinks`'s signature
changed. That is expected; Phase B fixes it. If the implementer wants to
keep `main` green between phases, add a thin shim in `framework-build.ts`
that re-exports `PLUGIN_AGENT_OUTPUT_EXT` (deprecated) and a default value
for the new option — both removed in Phase B. Optional, not required.

---

### Phase B — Use-case rewrite (synthesis + path inversion)

**Objective**: Replace every shape-emission method in
`FrameworkBuildUseCase`. After this phase, the use-case produces
Copilot-native output for plugin manifests, agents, hooks, mcp, and
content rewrites.

**Files touched**:

- `src/application/use-cases/framework/framework-build-use-case.ts` —
  **rewrite the named methods listed in §4 / Rewrite table**. Inline diff
  is too dense for this plan; the implementer follows §2 (M-v2.1 to
  M-v2.7) plus the spec §"Per-plugin output" verbatim.
- `tests/application/use-cases/framework/framework-build-use-case.integration.test.ts` —
  **invert affected assertions** (see §4 Rewrite table for the row);
  Phase D will close the rest.

**Method-size discipline** (≤ 20 LOC per `06-design-patterns/6-method-size.md`):

- `synthesizePluginManifest(pluginSrc, sourceManifest, presence)` returns the
  object literal in M-v2.6 order. Conditional field assignment guarded by
  the presence flags. ≤ 20 LOC.
- `detectPluginPresenceFlags(pluginSrc)` returns
  `{ hasAgents: boolean, skillsList: readonly string[], hasHooksJson: boolean, hasMcpJson: boolean }`.
- `rewriteHooksJson(srcPath, destPath)`:
  1. Read raw → `JSON.parse` → `rewriteClaudeRootInJson` →
     `JSON.stringify(_, null, 2) + "\n"` → `fs.writeFile`.
- `rewriteMcpJson(srcPath, destPath)`: identical body, different paths.
- `buildAgentFile` keeps its outline but: (a) no rename — `outName = basename(absPath)`,
  (b) `currentFilePluginRelative = "agents/" + outName` passed to
  `rewriteRelativeLinks`.
- `buildSkillFile` keeps its outline but:
  (a) `currentFilePluginRelative = "skills/" + relPath` passed to
  `rewriteRelativeLinks` (when the file is `.md`).
- `buildManifest` becomes a thin wrapper that calls
  `synthesizePluginManifest` + writes to `OUTPUT_PLUGIN_MANIFEST_RELATIVE`.
- The source `.claude-plugin/plugin.json` is no longer copied.

**Test gate**:

- All Phase-B integration assertions green. Pre-existing assertions touching
  Copilot-native output paths must pass; pre-existing assertions still tied
  to v1 shape are inverted in Phase D and may stay red here.
- `pnpm typecheck` green.

**Exit criterion**:

- The synthesized plugin.json validates against the bundled Claude *manifest*
  schema is **not** the goal — the synthesized output now targets Copilot.
  Schema validation in the use-case stays on the **source** plugin.json
  (input contract), per spec AC #10.
- AC mapping: **#1** (Copilot-native layout), **#5** (content rewrite with
  three branches), **#6** (no rename, FM allowlist), **#7** (no
  `${CLAUDE_PLUGIN_ROOT}` survives in JSON), **#8** (synthesized fields
  conditional on source presence).

---

### Phase C — Marketplace emitter rewrite

**Objective**: Replace `emitMarketplace`, `buildMarketplaceObject`,
`buildMarketplacePluginEntries`, `resolvePluginEntry`, `resolvePluginVersion`
with the Copilot-native shape per M-v2.7.

**Files touched**:

- `src/application/use-cases/framework/framework-build-use-case.ts` —
  **modify** the marketplace-emission methods.
- The destination path is `OUTPUT_MARKETPLACE_RELATIVE`
  (`.github/plugin/marketplace.json`).

**New private methods** (each ≤ 20 LOC):

- `emitMarketplaceCopilot(sourceMarketplace, builtPlugins, outDir)`:
  builds the object via `buildCopilotMarketplaceObject`, validates against
  `assetProvider.loadMarketplaceSchema()`, serializes with the fixed key
  order from M-v2.7, writes to `OUTPUT_MARKETPLACE_RELATIVE`.
- `buildCopilotMarketplaceObject(source, pluginEntries)` returns
  `{ name, metadata, owner, plugins: pluginEntries }`. `metadata` is built
  from `{ description: source.description, version: source.version, pluginRoot: "./plugins" }`.
- `buildCopilotPluginEntries(source, builtPlugins)` returns one entry per
  built plugin with the M-v2.7 field-sourcing rules; reads the
  **synthesized** output plugin.json for fallback (not the source —
  description fallback path).
- `resolveDescription(sourceEntry, pluginName, outDir)` — new method,
  enforces the description fallback chain and throws
  `InvalidSourceMarketplaceError` when both sources are empty (M-v2.7
  inverted-from-v1 rule).

**Test gate**:

- `pnpm test framework-build-use-case.integration` green (all assertions
  reflect Copilot-native shape; idempotency block still green; field-sourcing
  block updated to assert description fallback throws when both sources
  lack a description).

**Exit criterion**:

- The emitted marketplace.json validates against the bundled
  `copilot-plugin-marketplace.json` schema.
- AC mapping: **#2** (deterministic key order), **#3** (validates against
  the bundled Copilot-native schema), **#9** (Copilot-native marketplace
  shape).

---

### Phase D — Test inversion + new fixture

**Objective**: Bring every test file into v2 alignment. Add the new content
rewrite case to the shared fixture.

**Files touched**:

- `tests/fixtures/framework/plugins/aidd-test/skills/hello.md` — **modify**
  per §4 Fixtures table. Audit other tests reading this file
  (`grep -r "hello.md" tests/`) to confirm no assertion breaks on the new line.
- `tests/application/use-cases/framework/framework-build-use-case.integration.test.ts`:
  - `describe("manifest copy")` → `describe("plugin manifest synthesis")`.
    Assert: written at `<out>/plugins/aidd-test/.github/plugin/plugin.json`;
    contains synthesized fields per M-v2.6; does **not** contain `strict`,
    `$schema`; conditional fields appear only when source artifacts exist
    (parametrize via two sub-cases: with-skills and without-skills).
  - `describe("agent rename + frontmatter strip")` → `describe("agent emission + frontmatter strip")`.
    Assert: agent at `<out>/plugins/aidd-test/agents/code-reviewer.md` (no `.agent.md`);
    frontmatter allowlist still enforced.
  - `describe("hooks copy")` → `describe("hooks rewrite")`. Assert: hooks.json
    string values no longer contain `${CLAUDE_PLUGIN_ROOT}`; they contain
    `./scripts/check.sh`; JSON shape is otherwise structurally identical
    (parse + deep-equal minus the substituted strings).
  - `describe("mcp copy")` → `describe("mcp rewrite")`. Same inversion;
    assert `mcpServers.aidd-test-server.command` becomes `./bin/server.js`.
  - `describe("marketplace emission")`: assert
    `<out>/.github/plugin/marketplace.json` (path) and
    `parsed.plugins[0].source === "aidd-test"` (bare name).
  - `describe("marketplace field sourcing")`: add a case for the new
    "description fallback halts when both sources empty" rule (M-v2.7);
    remove the "defaults strict and recommended to false" case (fields are
    dropped).
  - `describe("idempotency")` stays as-is.
  - `describe("safety guard")` — update the three assertions to expect
    `InvalidBuildPathsError` (M-v2.10) in place of
    `FrameworkBuildOutputInsideSourceError`.
- `tests/e2e/framework-build.e2e.test.ts`:
  - AC #5 + #6 path: `code-reviewer.agent.md` → `code-reviewer.md`;
    also assert the new `@${CLAUDE_PLUGIN_ROOT}/...` reference in
    `skills/hello.md` produces the expected relative markdown link.
  - AC #7: invert from "contains `${CLAUDE_PLUGIN_ROOT}`" to "does not
    contain `${CLAUDE_PLUGIN_ROOT}` and contains `./scripts/check.sh` (hooks)
    / `./bin/server.js` (mcp)".
  - AC #1 + #4: install path under copilot must use the new
    `.github/plugin/plugin.json`. Verify after `plugin install` that the
    installed agent file exists; check that the marketplace add step
    locates the new `.github/plugin/marketplace.json` (this may require
    confirming `MarketplaceAddUseCase` reads from both paths — see §6
    Risks).
- `tests/application/use-cases/framework/plugin-manifest-synthesis.integration.test.ts`
  — **create** (or merge as additional `describe` block inside the main
  integration file; cleaner as a single integration test with sub-describe
  blocks per spec §"Field synthesis rules").

**Test gate**:

- `pnpm test:unit` green.
- `pnpm test:integration` green.
- `pnpm test:e2e` green.

**Exit criterion**:

- Every spec AC has at least one explicit assertion (see §6 AC matrix).
- AC mapping: **#5**, **#6**, **#7**, **#8** end-to-end; **#4** install
  round-trip in e2e.

---

### Phase E — Gate

**Objective**: One commit closes the delta. Bundle, lint, typecheck, e2e.

**Files touched**: none new; only verification.

**Test gate** (CI-style):

- `pnpm build` green; bundle ≤ 500 KB (`scripts/check-bundle-size.mjs`).
- `pnpm typecheck` green.
- `pnpm lint` green.
- `pnpm test` (full pyramid) green.
- Manual smoke (optional): `node dist/cli.js framework build --source tests/fixtures/framework --target copilot --out /tmp/aidd-v2-smoke && find /tmp/aidd-v2-smoke -name "plugin.json"` shows the new `.github/plugin/plugin.json` location.

**Exit criterion**:

- All five spec ACs covered end-to-end (see §6).
- Bundle within budget.

---

## 6. AC → Phase coverage matrix

| AC  | Statement (abbrev., spec v2)                                                                                                | Phases covering | Validation                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| #1  | Build produces a Copilot-readable tree (`.github/plugin/...` paths)                                                          | B, C, D, E      | Phase-B/C use-case rewrites; Phase-D integration assertions; Phase-E e2e                                                  |
| #2  | Byte-identical re-runs (deterministic JSON, no timestamps)                                                                  | A, B, C, D      | Schema swap + helper purity (A); fixed field-order synthesis (B, C); integration `describe("idempotency")` (D)            |
| #3  | `marketplace.json` validates against bundled Copilot schema                                                                 | A, C            | Hand-crafted schema in `assets/schemas/copilot-plugin-marketplace.json`; ajv validation in `emitMarketplaceCopilot`        |
| #4  | `marketplace add` + `plugin install --tool copilot` round-trip                                                              | D, E            | Phase-D e2e scenario 1; Phase-E manual smoke                                                                              |
| #5  | All three `@` forms rewritten in `.md` files                                                                                | A, B, D         | Phase-A unit on `rewriteRelativeLinks` with new branch; Phase-B integration on `buildSkills`/`buildAgents`; Phase-D e2e   |
| #6  | Agents stay `.md`; FM restricted to allowlist                                                                               | B, D            | Phase-B `buildAgentFile` no-rename; Phase-D integration on FM strip                                                       |
| #7  | `${CLAUDE_PLUGIN_ROOT}` rewritten in `hooks.json` + `.mcp.json` strings                                                     | A, B, D         | Phase-A unit on `claude-root-path-rewrite`; Phase-B `rewriteHooksJson`/`rewriteMcpJson`; Phase-D integration + e2e        |
| #8  | Conditional fields in synthesized plugin.json                                                                               | B, D            | Phase-B `synthesizePluginManifest` + `detectPluginPresenceFlags`; Phase-D synthesis integration test                      |
| #9  | Copilot-native marketplace schema (`metadata.pluginRoot`, simple-string source)                                             | C, D            | Phase-C emitter; Phase-D integration `describe("marketplace emission")`                                                   |
| #10 | Invalid manifest halts with `JsonSchemaValidationError`; safety guard halts with `InvalidBuildPathsError` (M-v2.10 rename)  | A, B            | Phase-A renames the error class; Phase-B keeps `validateManifest` + `guardPaths` behavior unchanged; integration `describe("manifest validation")` + updated `describe("safety guard")` assertions on the new name |
| #11 | Unit tests per pipeline step + one integration driving full build + e2e install                                             | A, B, C, D, E   | All `describe` blocks listed in Phase-D plus the Phase-E e2e suite                                                        |

---

## 7. Risks + mitigations

| Risk                                                                                                                                       | Likelihood | Impact | Mitigation                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MarketplaceAddUseCase` and `PluginInstallUseCase` may still expect Claude-format paths and fail the e2e round-trip (AC #4)               | Medium     | High   | Phase-D includes a smoke check: read the install-side code path and confirm it supports the `.github/plugin/` lookup. If not, this becomes an explicit blocker rather than silently failing AC #4. The implementer should run the e2e suite incrementally during Phase B/C, not only in Phase E.                                                                                  |
| `agents` field shape ambiguity (string vs array — spec text vs empirical confirmation)                                                     | Medium     | Low    | Follow the spec text (string). If Copilot rejects at install time, the change is one line in `synthesizePluginManifest`. Captured as a `decisions_blocked` entry so the reviewer sees it.                                                                                                                                                                                          |
| Method-size creep in the rewritten use-case (8 methods replaced + 4 new)                                                                   | Medium     | Low    | Plan v2 names each method explicitly (`synthesizePluginManifest`, `detectPluginPresenceFlags`, `rewriteHooksJson`, `rewriteMcpJson`, `emitMarketplaceCopilot`, `buildCopilotMarketplaceObject`, `buildCopilotPluginEntries`, `resolveDescription`). Lint does not enforce method size; surfaces in review.                                                                          |
| `rewriteClaudeRootInJson` over-rewrites string keys (not just values)                                                                      | Low        | Medium | Helper iterates `Object.entries(parsed)` and only rewrites `value` strings, never `key` strings. Phase-A unit test asserts that an object with `"${CLAUDE_PLUGIN_ROOT}/foo"` as a key (synthetic edge case) keeps the key as-is.                                                                                                                                                    |
| `@${CLAUDE_PLUGIN_ROOT}/X` rewrite produces a wrong relative path when the current file is at the plugin root                              | Low        | Medium | Phase-A unit case: file at `skills/SKILL.md` referencing `@${CLAUDE_PLUGIN_ROOT}/skills/other.md` → `[other.md](./other.md)`. Verifies leading-dot prepend for same-directory targets.                                                                                                                                                                                              |
| Description-fallback inversion (v1 emitted empty string, v2 throws) breaks existing fixtures or e2e                                        | Low        | Low    | The in-repo fixture has descriptions on both the marketplace entry and the plugin.json. Phase-D integration adds an explicit "both missing → throws" case; e2e is unaffected.                                                                                                                                                                                                       |
| Bundle budget regression (new schema + new helper)                                                                                         | Low        | Low    | Old schema (509 lines) is *deleted*; new hand-crafted schema is smaller (~150 lines projected). Net delta should be negative. Verify in Phase E with `scripts/check-bundle-size.mjs`.                                                                                                                                                                                              |
| Hexagonal violation: tempted to import `path` in `claude-root-path-rewrite.ts`                                                             | Low        | Low    | The helper does only string prefix substitution; no path math. Reviewer grep: no `from "node:path"` in `src/domain/formats/claude-root-path-rewrite.ts`.                                                                                                                                                                                                                          |
| Phase A leaves `main` red because the use-case still references deleted constants                                                          | Medium     | Low    | Phases land on the feature branch, not on `main`. Implementer may collapse Phase A + B into a single commit if intermediate redness is undesired. Plan does not require strict per-phase commit boundaries — only that the final state is mergeable.                                                                                                                              |

---

## 8. Definition of done

- All five phases land as commits on `feat/framework-build-copilot` with
  conventional-commit messages.
- `pnpm build && pnpm test && pnpm lint && pnpm typecheck` green.
- Bundle ≤ 500 KB (`scripts/check-bundle-size.mjs`).
- Every v2 AC (#1–#11) has at least one explicit assertion mapped to it
  (§6 AC matrix).
- No code touches `src/domain/tools/ai/copilot.ts` install handlers.
- The repo grep `${CLAUDE_PLUGIN_ROOT}` returns hits **only** in the source
  fixtures (`tests/fixtures/framework/plugins/aidd-test/hooks/hooks.json`,
  `tests/fixtures/framework/plugins/aidd-test/.mcp.json`) and the rewriter
  / use-case source files — **never** in the built `<out>/plugins/...` tree
  during a fresh e2e run.

---

## 9. Out of scope (mirroring spec v2 § "Out of scope (MVP1)")

- Targets other than `copilot`. The single-valued `FrameworkBuildTarget` type
  stays single-valued.
- Bundled plugin `commands/` or `rules/` directories — still warn + skip.
- GitHub Action wrapping the CLI — MVP2.
- Tarball-as-marketplace-source — MVP3.
- Cursor / OpenCode targets — `rewriteRelativeLinks` is now Copilot-shaped
  by virtue of M-v2.3; widening to other targets requires another spec.
