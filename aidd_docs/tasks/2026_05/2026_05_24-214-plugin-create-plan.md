---
plan_id: 214-plugin-create
ticket: https://github.com/ai-driven-dev/aidd-cli/issues/214
repo: ai-driven-dev/aidd-cli
branch: feat/214-plugin-create
date: 2026-05-24
objective: Ship `aidd plugin create <name>` — a template generator that scaffolds a valid Claude Code plugin tree at `<output>/<name>/`, validates the generated manifest against the bundled Claude Code plugin manifest schema, and (interactively) appends an entry to the project's `marketplace.json` when present.
success_condition: "pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint && pnpm build"
acceptance_criteria:
  - "`aidd plugin create <name>` scaffolds the full layout at `<cwd>/plugins/<name>/` (default `--type full`, default `--output <cwd>/plugins`)."
  - "`--type <skills|agents|hooks|mcp|full>` controls which component dirs are scaffolded; subset types ship only that component (plus `.claude-plugin/plugin.json`, `README.md`, `CHANGELOG.md`)."
  - "`--output <dir>` overrides the base path; final plugin path is `<dir>/<name>/`."
  - "Interactive: when `--type` is omitted and stdout is a TTY and `--yes` is not set, prompt for type. With `--yes` or non-TTY, default to `full`."
  - "Generated `plugin.json` validates against the bundled `claude-code-plugin-manifest.json` schema (schemastore mirror); validation runs before write — failure aborts with no files on disk."
  - "Integration test: `aidd plugin create demo` followed by `aidd plugin install ./plugins/demo` against a fresh project root succeeds end-to-end (manifest written, no doctor errors)."
  - "Target dir exists → fail with `Directory '<path>' already exists. Use --force to overwrite.` and exit non-zero. `--force` → recursive delete then rescaffold."
  - "Interactive: if `<cwd>/.claude-plugin/marketplace.json` exists, prompt `Add to local marketplace.json? [Y/n]` (default Y); on yes, append entry with relative `source`. Non-interactive (`--yes` or non-TTY): skip silently. Missing marketplace.json → skip silently."
  - "Per-skill scaffolding matches framework convention: `skills/00-example/{SKILL.md, actions/, references/, evals/scenarios.json, assets/}` — empty dirs preserved via `.gitkeep`."
out_of_scope:
  - "`aidd plugin lint` integration (deferred to #77)."
  - "Auto-publish to a remote marketplace registry."
  - "Tool-specific scaffolding — the generated layout is tool-agnostic (Mode A/B universality lives in the framework, not in the scaffold)."
  - "Modifying the host project's `.aidd/manifest.json` — `create` writes to a plugin author's tree only."
  - "Mutating any existing marketplace entry — only append; collision is a hard error."
  - "Prompting for a target-tools subset (component layout is intentionally tool-agnostic)."
---

## Critical re-framing before reading the phases

This command is a **pure write-side scaffolder**. It does not touch `.aidd/manifest.json`, does not call the marketplace registry, does not fetch over the network at runtime, and does not invoke the post-install pipeline. The only project-state mutation it can perform is appending an entry to a pre-existing `<cwd>/.claude-plugin/marketplace.json`. That makes the architectural surface small: a use-case that builds a `ReadonlyMap<relativePath, content>` in memory, validates the embedded `plugin.json` against a bundled schema, then commits to disk via `FileWriter`.

Two design forks the brief left open are resolved up front, in this plan, before any code is written (see Decisions D1 and D2). Both lean toward determinism and offline reliability over runtime flexibility.

The framework-canonical skill layout is `SKILL.md` + `actions/` + `references/` + `evals/scenarios.json` + `assets/`. This is verified against `/Users/baptistelafourcade/Projects/freelance/aidd/aidd/framework/plugins/aidd-context/skills/01-bootstrap/` and locked as the scaffold target.

---

## M / C / D

### Must

- **M1.** New subcommand `aidd plugin create <name>` added to `src/application/commands/plugin.ts`, action handler is a thin wrapper that parses flags, creates deps, calls one use-case, displays one success line. ≤30 LOC excluding flag declarations, per `0-command-thin-wrapper.md`.
- **M2.** New use-case `PluginCreateUseCase` at `src/application/use-cases/plugin/plugin-create-use-case.ts`. `execute()` ≤20 LOC, orchestrates ~6 private helpers (validate inputs → build scaffold map → validate manifest → handle conflict → write files → optionally append marketplace entry).
- **M3.** New domain helpers in `src/domain/models/plugin-scaffold.ts` — pure functions returning string content per file. Each helper ≤20 LOC. No I/O. Helpers: `manifestJsonContent`, `readmeContent`, `changelogContent`, `skillContent`, `agentContent`, `hooksJsonContent`, `mcpJsonContent`, `scenariosJsonContent`. One umbrella `buildScaffold(name, kind, version)` returns `ReadonlyMap<string, string>` (path → content).
- **M4.** New discriminant type `PluginComponentKind = "skills" | "agents" | "hooks" | "mcp" | "full"` at `src/domain/models/plugin-component-kind.ts`, plus `parsePluginComponentKind(s: string | undefined): PluginComponentKind` that throws `InvalidPluginComponentKindError` on unknown values. Default resolution (`undefined` → `"full"`) lives at the **use-case input boundary**, not in the parser, so the command can pass `undefined` and the use-case can prompt or default. Default in the parser would leak the command-layer policy into the domain.
- **M5.** New port `JsonSchemaValidator` at `src/domain/ports/json-schema-validator.ts` with a single method `validate(schema: object, data: unknown): void` that throws a typed `JsonSchemaValidationError` (new, in `src/domain/errors.ts`) with one or more error lines on failure. One method, well under the 5-method port budget.
- **M6.** New adapter `AjvSchemaValidatorAdapter` at `src/infrastructure/adapters/ajv-schema-validator-adapter.ts`. Wraps `ajv` (added to dependencies — `ajv` and `ajv-formats`). Translates ajv errors into `JsonSchemaValidationError` with paths and messages.
- **M7.** Bundled schema asset at `src/infrastructure/assets/schemas/claude-code-plugin-manifest.json` — frozen vendor copy of `https://json.schemastore.org/claude-code-plugin-manifest.json`. Loaded via `AssetProvider` (existing port) or via a new asset key on `BundledAssetProviderAdapter`. **Schema is bundled, not fetched at runtime.** This is the firm decision; see D1.
- **M8.** New domain error `InvalidPluginComponentKindError` and `JsonSchemaValidationError` and `PluginTargetExistsError` and `MarketplaceEntryAlreadyExistsError` in `src/domain/errors.ts`, following the existing pattern (extend `Error`, set `this.name`, throw with actionable message).
- **M9.** New marketplace shape contract: read-and-append helper `appendPluginToMarketplace(marketplaceJsonContent: string, entry: MarketplaceLocalEntry): string` lives in `src/domain/formats/marketplace-json.ts` (new file, pure JSON-in / JSON-out). It (a) parses, (b) throws `MarketplaceEntryAlreadyExistsError` on name collision in `plugins[]`, (c) appends, (d) returns pretty-printed JSON preserving 2-space indent and trailing newline. No I/O in this module.
- **M10.** `PluginCreateUseCase` reuses `FileReader` + `FileWriter` (already in `Deps.fs`), and reuses `FileWriter.deleteDirectory` for `--force`. No new I/O port methods required.
- **M11.** Validation runs on the **in-memory** `plugin.json` content before any write. If validation throws, nothing lands on disk. See D2.
- **M12.** Wire `pluginCreateUseCase` into `createDeps()`. Add `ajvSchemaValidator` instantiation; pass it + `fs` + `prompter` + `logger` + `assetProvider` into the use-case.
- **M13.** Acceptance-critical tests: 5 scaffold-shape unit tests (one per `--type`), 1 schema-validation throw unit test (malformed manifest), 1 conflict-fails unit test, 1 force-overwrites unit test, 1 marketplace-append unit test (accept + decline), 1 integration test `create → plugin install` round-trip on a tmpdir.
- **M14.** CLI's **own** `CHANGELOG.md` (`/Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/CHANGELOG.md`) gets an Unreleased entry. Do not conflate with the **generated plugin's** `CHANGELOG.md` (which is a template artifact written by the scaffold).
- **M15.** Empty dirs in the scaffold (`skills/00-example/actions/`, `references/`, `assets/`, `hooks/routing/`) are preserved on disk via `.gitkeep` placeholder files. Justification: framework convention; `FileWriter` writes files, not directories, and downstream tooling (`aidd plugin install`) walks files only — empty dirs would vanish on copy regardless.

### Could (deferred to follow-up unless time allows)

- **C1.** Schema-drift CI test: a separate integration test that fetches the live schemastore URL and diffs against the bundled copy. Fails CI when upstream changes so refresh is forced, not silent. Recommended but not blocking.
- **C2.** `--description <text>` flag and `--version <semver>` flag to override defaults. Spec is silent; the v1 generated manifest can hardcode `"version": "0.1.0"` and `"description": "<name> plugin scaffold"`. Trivial to add later.
- **C3.** `aidd plugin create --dry-run` that prints the file tree without writing. Useful for testing; not in spec.

### Don't

- **D-X1.** Do NOT fetch the schema over the network at command runtime. (D1)
- **D-X2.** Do NOT write any files before manifest validation succeeds. (D2)
- **D-X3.** Do NOT mutate the host project's `.aidd/manifest.json`. This command writes to a plugin author's tree, not to the consumer-project's installed state.
- **D-X4.** Do NOT call the post-install pipeline (`marketplaceSyncSettingsUseCase`). Out of scope — the scaffold is not an install.
- **D-X5.** Do NOT silently skip on marketplace name collision — fail with an actionable message (D3).
- **D-X6.** Do NOT mutate existing entries in `marketplace.json` — only append.
- **D-X7.** Do NOT hardcode `./plugins/<name>` as the marketplace `source` field — compute relative path from the marketplace.json's containing directory to the plugin directory (D4).
- **D-X8.** Do NOT add new methods to `FileWriter`. The port already covers `writeFile`, `createDirectory`, `deleteDirectory` — enough for this command.
- **D-X9.** Do NOT introduce a second prompt for plugin description; reuse the value already embedded in the generated `plugin.json` (D5).
- **D-X10.** Do NOT add a `JsonSchemaValidator` method that returns a result object. Throw on invalid. Use-cases throw, per `0-error-handling.md`.

---

## Decisions (locked before implementation)

### D1 — Bundle the schema, do not fetch at runtime

The brief left this open. Decision: **bundle**.

- **Source URL** (locked in spec): `https://json.schemastore.org/claude-code-plugin-manifest.json`.
- **Bundled location**: `src/infrastructure/assets/schemas/claude-code-plugin-manifest.json`.
- **Refresh procedure**: documented in a short header comment at the top of the JSON file (or a sibling `README.md`) — "Refreshed YYYY-MM-DD from <URL>. To refresh: curl -sL <URL> > <path>, then re-run pnpm test."
- **Schema drift detection**: an optional integration test (C1) fetches the live URL and diffs; fails CI when upstream changes. Marked Could so it doesn't gate this ticket.

**Rationale:** runtime network calls break offline use, CI determinism, and test isolation. The schemastore URL is the *contract*, not a runtime dependency. Vendoring also lets us assert the schema's `required` set (`["name"]` as of 2026-04-23) in our test suite — see Pre-flight check below.

**Pre-flight check (must complete before Phase 3):** the implementer fetches the live schema and confirms (a) `required: ["name"]`, (b) `"version"` is **not** required (so we generate a manifest with version anyway for future-proofing), (c) no unexpected top-level required fields appeared. If upstream added more required fields, the scaffold template must include them. Already verified at planning time (2026-05-24): required is `["name"]`; current top-level properties: `$schema, name, version, description, author, homepage, repository, license, keywords, dependencies, hooks, commands, agents, skills, outputStyles, themes, channels, mcpServers, lspServers, monitors, settings, userConfig`. Implementer re-verifies at bundling time.

### D2 — Validate before write, not after

Spec phrasing: "After write, parse `plugin.json` and validate against ... Fail loud if invalid (defensive)."

Decision: **validate in-memory before write**, then write. The spec's "fail loud" intent is preserved; the "after write" sequencing is reinterpreted as defensive against template authoring mistakes — easier to enforce by validating before any file lands on disk. Avoids the rollback problem: a partial scaffold with an invalid manifest is strictly worse than no scaffold.

Sequence inside `PluginCreateUseCase.execute()`:

1. Validate `name` against `PLUGIN_NAME_REGEX` (reused from `src/domain/models/plugin.ts`).
2. Resolve `kind` (prompt or default to `full`).
3. Resolve `outputDir`, compute `pluginDir = <outputDir>/<name>`.
4. Build `ReadonlyMap<string, string>` of scaffold files via `buildScaffold(name, kind, version)`.
5. Parse the in-memory `plugin.json` string from the map.
6. **Validate against bundled schema** — throws on failure, nothing written yet.
7. Check `pluginDir` existence; if exists and `!force`, throw `PluginTargetExistsError`.
8. If `force`, `await fs.deleteDirectory(pluginDir)`.
9. Iterate map, write files via `fs.writeFile` (which creates parent dirs in the existing adapter — verify; if not, `createDirectory` first).
10. If `marketplace.json` exists and (interactive and confirmed), call marketplace-append path.

### D3 — Marketplace name collision: fail, don't skip

Spec silent. Decision: throw `MarketplaceEntryAlreadyExistsError` with message `Plugin '<name>' is already listed in <marketplaceJsonPath> at index <N>. Edit manually or choose a different plugin name.`

**Rationale:** silent skip is worse — the author won't realize the entry wasn't added. Auto-update is risky — could overwrite a richer existing entry (different `description`, `recommended: true`, etc.). The hard-error path forces an explicit author decision.

The plugin scaffold itself still lands on disk; the marketplace-append step is a discrete, optional post-step. So a collision is **not** rolled back — the user gets: scaffold succeeded + marketplace entry was NOT appended + clear error explaining why. (Equivalent to declining the marketplace prompt.) Document this in the success message: `Plugin scaffolded at <path>. Marketplace entry skipped: <reason>.`

### D4 — Marketplace `source` field is relative to the marketplace.json's directory

Spec example shows `source: "./plugins/<name>"` but that example assumes the default `--output <cwd>/plugins/`. If the author runs `aidd plugin create demo --output ../shared/plugins` while standing in a project whose `.claude-plugin/marketplace.json` exists, the entry's `source` must resolve from the marketplace.json's directory to the new plugin directory.

Decision: compute `entry.source` as `./` + `path.relative(path.dirname(marketplaceJsonPath), pluginDir)` (with the leading `./` preserved when the path is non-absolute and inside the project, mirroring the existing entries' shape — see `/Users/baptistelafourcade/Projects/freelance/aidd/aidd/framework/.claude-plugin/marketplace.json` lines 11, 19, 27, 35, 43, 51).

If the plugin lives **outside** the marketplace.json's containing directory tree, `path.relative` will produce `../...` — that's correct and valid for Claude Code marketplace local sources.

### D5 — Marketplace entry shape is fixed; no second prompt

Decision: the appended entry is exactly:

```json
{
  "name": "<name>",
  "version": "0.1.0",
  "source": "<computed relative path, see D4>",
  "description": "<from in-memory plugin.json>",
  "recommended": false,
  "strict": true
}
```

`description` is pulled from the just-built `plugin.json` content (we already have it in memory after step 5 of D2). No second prompt. `version`, `recommended`, `strict` are fixed by spec.

### D6 — `--force` semantics: full rm -rf, not merge

Spec: "`--force` → rm -rf + re-scaffold." Decision: literal interpretation. Implementation calls `fs.deleteDirectory(pluginDir)` (existing port method) then proceeds with the normal scaffold path. No merge, no preservation of user files inside the existing tree.

**Risk:** an author runs `--force` against a path they didn't realize was populated. Mitigation: the existence check fires *before* `--force` consumes anything; the success-path log line should explicitly say `Overwriting existing directory <path>.`

### D7 — Acceptance-criterion test placement and pyramid fit

AC#6 requires `create → plugin install` round-trip. `PluginAddUseCase` reads file hashes, walks directories, calls `FileReader.listFilesRecursive`. In-memory adapters for these are non-trivial and existing integration tests already prove the install path against a real temp filesystem. Decision: **AC#6 is an integration test against a real tmpdir**, not a unit test, per `5-test-pyramid.md`. Unit tests cover scaffold shape (M13); integration covers the round-trip.

### D8 — Discriminant default lives at use-case input boundary

`PluginComponentKind` parser does NOT default `undefined` to `"full"`. The use-case input type is:

```ts
interface PluginCreateInput {
  name: string;
  kind: PluginComponentKind | undefined; // undefined = "prompt or default"
  outputDir: string; // already resolved by command (cwd + "plugins" or --output)
  force: boolean;
  yes: boolean;
  interactive: boolean; // process.stdout.isTTY at command layer
}
```

The use-case applies the default rule: if `kind === undefined` && `interactive` && !`yes` → prompt; else → `full`. This keeps the discriminant parser pure (no environment coupling) and centralizes the policy in the use-case where the test suite covers it.

---

## Rules table — which project rule applies per phase

| Rule | P1 (Domain) | P2 (Use-case) | P3 (Validator) | P4 (Command wiring) | P5 (Marketplace append) | P6 (Tests + docs) |
| ---- | :---------: | :-----------: | :------------: | :-----------------: | :--------------------: | :---------------: |
| `00-architecture/0-hexagonal.md` | x | x | x | x | x | — |
| `00-architecture/0-layer-responsibilities.md` | x | x | x | x | x | — |
| `00-architecture/0-port-design.md` | — | — | x | — | — | — |
| `00-architecture/0-command-thin-wrapper.md` | — | — | — | x | — | — |
| `00-architecture/0-deps-wiring.md` | — | — | x | x | — | — |
| `00-architecture/0-error-handling.md` | x | x | x | x | x | — |
| `00-architecture/0-discriminant-types.md` | x | — | — | — | — | — |
| `00-architecture/0-post-install-pipeline.md` | — | — | — | — | — | n/a (not invoked here) |
| `01-standards/1-naming.md` | x | x | x | x | x | x |
| `01-standards/1-exports.md` | x | x | x | x | x | x |
| `02-programming-languages/2-typescript.md` | x | x | x | x | x | x |
| `03-frameworks-and-libraries/3-commander.md` | — | — | — | x | — | — |
| `03-frameworks-and-libraries/3-cli-output.md` | — | — | — | x | — | — |
| `04-tooling/4-biome.md` | x | x | x | x | x | x |
| `05-testing/5-test-pyramid.md` | x | x | x | — | x | x |
| `06-design-patterns/6-method-size.md` | x | x | x | x | x | — |
| `06-design-patterns/6-adapter.md` | — | — | x | — | — | — |
| `06-design-patterns/6-use-case.md` | — | x | — | — | — | — |
| `07-quality/7-clean-code.md` | x | x | x | x | x | x |
| `08-domain/8-value-objects.md` | x | — | — | — | — | — |

---

## Phases

Six phases. Each ships a coherent slice that compiles, passes lint, and has its own tests where applicable. Recommended commit boundaries match phase boundaries except Phase 1 and 2 may share a commit if the use-case lands cleanly.

### Phase 1 — Domain: name validation, type discriminant, pure scaffold helpers

**Scope:** all I/O-free domain pieces. No use-case, no command, no adapter.

**Tasks:**

- T1.1 Create `src/domain/models/plugin-component-kind.ts`. Export `PluginComponentKind` union, `parsePluginComponentKind(s: string | undefined): PluginComponentKind`. Parser rejects undefined as an error case (the use-case handles undefined explicitly per D8). Throws `InvalidPluginComponentKindError`.
- T1.2 Add `InvalidPluginComponentKindError`, `JsonSchemaValidationError`, `PluginTargetExistsError`, `MarketplaceEntryAlreadyExistsError` to `src/domain/errors.ts`, following the existing pattern (extend `Error`, `this.name = "..."`, actionable message in constructor).
- T1.3 Create `src/domain/models/plugin-scaffold.ts`. Exports:
  - `buildScaffold(input: { name: string; kind: PluginComponentKind; version: string; description: string }): ReadonlyMap<string, string>` — top-level orchestrator, ≤20 LOC, calls helpers.
  - Per-file pure helpers (each ≤20 LOC): `manifestJsonContent`, `readmeContent`, `changelogContent`, `skillContent`, `agentContent`, `hooksJsonContent` (returns `{"hooks":{}}`), `mcpJsonContent` (returns `{"mcpServers":{}}`), `scenariosJsonContent`.
  - A `.gitkeep` sentinel constant for empty-dir placeholders.
- T1.4 Create `src/domain/formats/marketplace-json.ts`. Exports `MarketplaceLocalEntry` type and `appendPluginToMarketplace(json: string, entry: MarketplaceLocalEntry): string`. Pure JSON-in / JSON-out. Throws `MarketplaceEntryAlreadyExistsError` on `plugins[].name` collision. Preserves 2-space indent and trailing newline (match the framework's marketplace.json style).
- T1.5 Reuse `PLUGIN_NAME_REGEX` from `src/domain/models/plugin.ts` — do **not** duplicate.

**Acceptance:**

- `pnpm typecheck` passes.
- All new files compile with no `any`.
- Unit tests (added in Phase 6 but stub now): `buildScaffold("demo", "full", "0.1.0", "demo plugin")` returns a `Map` whose key set exactly matches the spec's `full` layout, plus `.gitkeep` files in empty dirs.
- `buildScaffold("demo", "skills", …)` returns ONLY `.claude-plugin/plugin.json`, `README.md`, `CHANGELOG.md`, and the `skills/00-example/**` set.
- `appendPluginToMarketplace` round-trips JSON, throws on collision.

**Validation:** `pnpm typecheck && pnpm lint -- --files-changed-since=HEAD~1 src/domain/`.

**Commit boundary:** "feat(domain): scaffold helpers, PluginComponentKind, marketplace-json format (#214 part 1)".

---

### Phase 2 — Use case: `PluginCreateUseCase`

**Scope:** orchestration only. No CLI wiring, no adapter changes.

**Tasks:**

- T2.1 Create `src/application/use-cases/plugin/plugin-create-use-case.ts`. Class `PluginCreateUseCase` with constructor injecting: `FileReader & FileWriter` (typed as the existing `Deps.fs` aggregate), `Prompter`, `JsonSchemaValidator` (port from Phase 3 — declare import as `type` so Phase 2 can compile before Phase 3 lands its adapter), `AssetProvider`, `Logger`.
- T2.2 `execute(input: PluginCreateInput): Promise<PluginCreateResult>` is ≤20 LOC. Result type: `{ pluginDir: string; filesWritten: number; marketplaceUpdated: boolean }`.
- T2.3 Private helpers (each ≤20 LOC): `resolveKind`, `buildAndValidateManifest`, `ensureWritableTarget`, `writeScaffoldFiles`, `maybeAppendMarketplaceEntry`.
- T2.4 `resolveKind` implements D8: undefined + interactive + !yes → prompt (`prompter.select`); else → `"full"`.
- T2.5 `buildAndValidateManifest`: calls `buildScaffold`, extracts the `.claude-plugin/plugin.json` string, loads schema via `assetProvider`, calls `jsonSchemaValidator.validate(schema, parsedManifest)`. Throws `JsonSchemaValidationError` on failure (validator throws; use-case lets it propagate).
- T2.6 `ensureWritableTarget`: checks `fs.fileExists(pluginDir)` (note: `fileExists` returns true for both files and dirs — the existing `FileReader.fileExists` is the right primitive; verify by reading the existing adapter if behavior is dir-aware). If exists and !`force`, throw `PluginTargetExistsError`. If `force`, `fs.deleteDirectory(pluginDir)`.
- T2.7 `writeScaffoldFiles`: iterates the scaffold map, calls `fs.writeFile`. Existing `FileAdapter.writeFile` already creates parent directories — verify before relying on it; if not, prefix each write with `fs.createDirectory(path.dirname(...))`.
- T2.8 `maybeAppendMarketplaceEntry`: checks `<cwd>/.claude-plugin/marketplace.json` existence, gates on `interactive && !yes`, prompts `prompter.confirm("Add to local marketplace.json?", true)`, on yes reads the file, calls `appendPluginToMarketplace`, writes back via `fs.writeFile`. Catches no errors — `MarketplaceEntryAlreadyExistsError` propagates per D3.
- T2.9 Use-case never catches its own errors. Per `0-error-handling.md`.

**Acceptance:**

- `pnpm typecheck` passes.
- No method >20 LOC.
- `execute()` is a sequence of single-purpose helper calls, readable top-to-bottom.
- Test scaffolding (added in Phase 6) can mock `Prompter`, `JsonSchemaValidator`, and `FileReader+FileWriter` to drive every branch.

**Validation:** `pnpm typecheck && pnpm lint`.

**Commit boundary:** "feat(use-case): PluginCreateUseCase (#214 part 2)" — may be folded into Phase 1's commit if the implementer wants a single domain+use-case commit before introducing infrastructure.

---

### Phase 3 — Bundled schema asset + `JsonSchemaValidator` port and adapter

**Scope:** the validator port, the ajv-backed adapter, the bundled schema asset, and `AssetProvider` wiring to load it.

**Tasks:**

- T3.1 Add `ajv` and `ajv-formats` to `dependencies` in `package.json`. Run `pnpm install`. Bundle-size budget: ajv adds ~120KB minified — well within current budget; verify via `pnpm build:check-size`.
- T3.2 Create `src/domain/ports/json-schema-validator.ts`. Single method: `validate(schema: object, data: unknown): void`. Throws on invalid (no return value). Comment: "throws `JsonSchemaValidationError` on validation failure."
- T3.3 Create `src/infrastructure/adapters/ajv-schema-validator-adapter.ts`. Class `AjvSchemaValidatorAdapter` implements `JsonSchemaValidator`. Constructs an `Ajv` instance once, optionally `addFormats(ajv)` for `ajv-formats`. `validate(schema, data)`: `const validate = ajv.compile(schema); if (!validate(data)) throw new JsonSchemaValidationError(formatErrors(validate.errors))`.
- T3.4 Pre-flight: implementer runs `curl -sL https://json.schemastore.org/claude-code-plugin-manifest.json | jq '.required, (.properties | keys)'`. Confirms required is `["name"]` (as of 2026-05-24). If upstream added required fields, scaffold's `manifestJsonContent` (Phase 1) must include them — coordinate by amending the helper before merging.
- T3.5 Save the live schema to `src/infrastructure/assets/schemas/claude-code-plugin-manifest.json`. Add a sibling `README.md` documenting refresh procedure and the date the schema was vendored.
- T3.6 Extend `BundledAssetProviderAdapter` (or `AssetProvider` port if the existing API doesn't already allow arbitrary JSON asset loads) with a `loadPluginManifestSchema(): Promise<object>` method, or add the JSON to whatever existing asset-loading mechanism the codebase uses. Verify the existing adapter's surface before adding a new method — if a generic load-by-key path already exists, reuse it. (Port budget: `AssetProvider` is at 402B; spot-check the file before extending.)
- T3.7 Wire `ajvSchemaValidator: AjvSchemaValidatorAdapter` into `createDeps()` alongside other adapter instantiations.

**Acceptance:**

- `pnpm typecheck && pnpm test` passes.
- `pnpm build:check-size` reports total bundle within the existing budget (the script will fail loud if not).
- Unit test for `AjvSchemaValidatorAdapter`: valid input passes (no throw), invalid input throws `JsonSchemaValidationError` with at least one error line in `.message`.

**Validation:** `pnpm typecheck && pnpm test src/infrastructure/adapters/ajv-schema-validator-adapter.test.ts && pnpm build:check-size`.

**Commit boundary:** "feat(infra): JsonSchemaValidator port + AjvSchemaValidatorAdapter + bundled plugin manifest schema (#214 part 3)".

---

### Phase 4 — Command wiring: `aidd plugin create` action handler + deps wiring

**Scope:** the commander subcommand; `Deps` field; `createDeps()` instantiation of `PluginCreateUseCase`.

**Tasks:**

- T4.1 In `src/application/commands/plugin.ts`, add the `plugin.command("create <name>")` subcommand inside `registerPluginCommand`. Flags per spec:
  - `--type <skills|agents|hooks|mcp|full>` (no default in commander; use-case applies the default rule per D8)
  - `--output <dir>` (no default in commander; command resolves to `path.join(projectRoot, "plugins")` before calling the use-case)
  - `--force`
  - `--yes`
- T4.2 Action handler is a thin wrapper per `0-command-thin-wrapper.md`:
  - Parse and **pre-validate** `--type` via `parsePluginComponentKind` (throws → command catches via `errorHandler.handle`; spec's "fail loud" intent).
  - Pre-validate `<name>` against `PLUGIN_NAME_REGEX`; if invalid, `output.error("Invalid plugin name '<name>': must match ^[a-z0-9]+(-[a-z0-9]+)*$"); process.exit(1);` (per `3-commander.md`, validate inputs with output.error + exit, not throw).
  - Resolve `outputDir = cmdOptions.output ?? path.join(projectRoot, "plugins")` (use `path.resolve` to normalize).
  - Create deps via `await createDeps(projectRoot, { verbose }, output)`.
  - Call `deps.pluginCreateUseCase.execute({ name, kind: parsedKind, outputDir, force: !!cmdOptions.force, yes: !!cmdOptions.yes, interactive: process.stdout.isTTY })`.
  - Display result:
    - Success: `output.success(\`Plugin scaffolded at \${result.pluginDir} (\${result.filesWritten} files).\`)`; if `result.marketplaceUpdated`, `output.info("Marketplace entry appended to .claude-plugin/marketplace.json.")`.
  - Catch all errors via `errorHandler.handle(error)`.
- T4.3 Update `Deps` interface in `src/infrastructure/deps.ts` with `pluginCreateUseCase: PluginCreateUseCase`.
- T4.4 Instantiate in `createDeps()`: `const ajvSchemaValidator = new AjvSchemaValidatorAdapter();` then `const pluginCreateUseCase = new PluginCreateUseCase(fs, prompter, ajvSchemaValidator, assetProvider, logger);`. Add to the `deps` object returned.
- T4.5 Update the interactive top-level `plugin` menu (lines 12–27 of plugin.ts) to add `{ name: "Create a new plugin", value: "create", description: "scaffold a local plugin tree" }`. Verify this doesn't break the existing spawn pattern — `spawnCliCommand(["plugin", "create"])` would prompt for `<name>` interactively, which `aidd plugin create` (no `<name>`) currently can't do because commander requires the positional arg. Two options:
  - **Option A (chosen):** make `<name>` optional at the commander level (`plugin create [name]`), and if missing + interactive + !yes, prompt for it inside the use-case. This is consistent with how `plugin install [plugin]` handles the optional positional.
  - **Option B (rejected):** require `<name>` and have the menu shell out with a literal prompt — breaks the spawn pattern.
  - Decision: Option A. The command declaration becomes `plugin.command("create [name]")`. The action handler prompts for name when missing.

**Acceptance:**

- `aidd plugin create demo` (in a scratch dir) scaffolds `plugins/demo/` with the full layout.
- `aidd plugin create demo` (existing dir, no force) exits non-zero with the spec'd error message.
- `aidd plugin create demo --force` overwrites.
- `aidd plugin create demo --type skills` scaffolds skills-only.
- `aidd plugin create --help` shows all four flags + positional.
- Top-level `aidd plugin` menu lists "Create a new plugin".

**Validation:** `pnpm typecheck && pnpm lint && pnpm build && node dist/cli.js plugin create demo --output /tmp/aidd-214-smoke && ls /tmp/aidd-214-smoke/demo/.claude-plugin/plugin.json`.

**Commit boundary:** "feat(cli): aidd plugin create command (#214 part 4)".

---

### Phase 5 — Marketplace prompt and append flow

**Scope:** detect `<cwd>/.claude-plugin/marketplace.json`, prompt, append. Most of this is wired in Phase 2's `maybeAppendMarketplaceEntry` — Phase 5 ensures the end-to-end behavior is correct and tested.

**Tasks:**

- T5.1 In `PluginCreateUseCase.maybeAppendMarketplaceEntry`:
  - `const marketplaceJsonPath = path.join(projectRoot, ".claude-plugin", "marketplace.json")`. Note: `projectRoot` must be threaded into the use-case input — add to `PluginCreateInput`. (Spec says "if `<cwd>/.claude-plugin/marketplace.json` exists" — `projectRoot` is the resolved cwd at the command layer.)
  - If `!fs.fileExists(marketplaceJsonPath)`, log nothing, return `{ marketplaceUpdated: false }`.
  - If `!input.interactive || input.yes`, return `{ marketplaceUpdated: false }` (non-interactive skips, per spec).
  - Else, `await prompter.confirm("Add to local marketplace.json?", true)`. If declined, return `{ marketplaceUpdated: false }`.
  - Else:
    1. Read marketplace.json (`fs.readFile`).
    2. Build entry (name, version `"0.1.0"`, source per D4, description from the in-memory `plugin.json`, `recommended: false`, `strict: true`).
    3. Call `appendPluginToMarketplace(content, entry)` — may throw `MarketplaceEntryAlreadyExistsError`.
    4. Write back via `fs.writeFile`.
    5. Return `{ marketplaceUpdated: true }`.
- T5.2 Confirm `path.relative` produces the expected `./<rel>` shape. The framework's marketplace.json uses `./plugins/aidd-context` style with a leading `./`. `path.relative` returns just `plugins/aidd-context` for the default `--output`; the helper must prepend `./` when the result doesn't already start with `.`.
- T5.3 Update the success display in Phase 4's command handler to surface the actual marketplace-skip reason when `marketplaceUpdated` is false in a context where the file existed. (Trade-off: this requires `PluginCreateResult` to carry a `marketplaceSkipReason?: string`. Simpler shape: return `{ ...; marketplaceUpdated: boolean }` and let the use-case `logger.info("Marketplace entry skipped: <reason>")` directly. The latter keeps the result type tight. Choose the logger path.)

**Acceptance:**

- Integration test: in a tmpdir with `.claude-plugin/marketplace.json` (seeded with one entry), `create demo` then confirming the prompt yields a marketplace.json with two entries. Decline → still one entry.
- Integration test: in a tmpdir WITHOUT `.claude-plugin/marketplace.json`, `create demo` succeeds silently (no prompt, no marketplace work).
- Integration test: collision case — `marketplace.json` already has `name: "demo"`; running `create demo --yes` does nothing to marketplace (skipped because non-interactive). Running `create demo` and confirming throws `MarketplaceEntryAlreadyExistsError`.

**Validation:** integration test suite passes; `pnpm test test/integration/plugin-create.integration.test.ts`.

**Commit boundary:** "feat(use-case): marketplace.json append flow for plugin create (#214 part 5)" — can be merged into Phase 2's commit if Phase 2 lands together with Phase 4 and 5.

---

### Phase 6 — Tests, CHANGELOG, plugin command help

**Scope:** test coverage, CLI's own CHANGELOG, command help text polish.

**Tasks:**

- T6.1 Unit tests for `src/domain/models/plugin-scaffold.ts`:
  - `buildScaffold("demo", "full", "0.1.0", "demo plugin")` returns the exact spec'd key set.
  - One test per `--type` subset: `skills`, `agents`, `hooks`, `mcp`. Each asserts the produced key set is the minimal layout for that type plus the three universal files (`.claude-plugin/plugin.json`, `README.md`, `CHANGELOG.md`).
  - `manifestJsonContent("demo", "0.1.0", "demo plugin")` produces parseable JSON with `name: "demo"`, `version: "0.1.0"`, `description: "demo plugin"`.
- T6.2 Unit tests for `src/domain/models/plugin-component-kind.ts`:
  - `parsePluginComponentKind("skills")` returns `"skills"`.
  - `parsePluginComponentKind("nope")` throws `InvalidPluginComponentKindError`.
  - `parsePluginComponentKind(undefined)` throws (the use-case is responsible for the undefined → default policy, not the parser; D8).
- T6.3 Unit tests for `src/domain/formats/marketplace-json.ts`:
  - Round-trip: append entry, parse output, assert entry shape and position (last in `plugins[]`).
  - Collision: pre-existing entry with same name → throws.
  - Preserves indent + trailing newline (snapshot test).
- T6.4 Unit tests for `src/infrastructure/adapters/ajv-schema-validator-adapter.ts`:
  - Valid `{ name: "demo" }` passes.
  - Invalid `{ name: 42 }` throws with a message naming the path and the expected type.
  - Bundled plugin manifest schema loads and accepts our generated manifest.
- T6.5 Unit tests for `PluginCreateUseCase` with mocked ports:
  - All five `--type` branches scaffold the expected file count.
  - Validation failure (mock the validator to throw) leaves zero files written (assert `fs.writeFile` was not called).
  - Conflict + !force throws; conflict + force calls `deleteDirectory` then proceeds.
  - Non-interactive `kind=undefined` defaults to `full`.
  - Interactive `kind=undefined` calls `prompter.select`.
- T6.6 Integration test `test/integration/plugin-create.integration.test.ts`:
  - **AC#6 round-trip:** create `demo` in a tmpdir, then run the actual `PluginInstallUseCase` (or `PluginAddUseCase` with the local-path source) against the same tmpdir, asserting the manifest writes `.aidd/manifest.json` cleanly and `doctorUseCase` reports healthy.
  - Marketplace append accept/decline (per Phase 5 tests).
  - `--force` overwrites correctly when prior tree has different files.
- T6.7 CLI's own `CHANGELOG.md` — add an Unreleased entry: `### Added\n- \`aidd plugin create <name>\` — scaffold a local plugin tree with manifest validation and optional marketplace.json append. (#214)`.
- T6.8 Command help string: ensure `plugin.command("create [name]").description("Scaffold a new plugin (.claude-plugin/plugin.json + selected components)")` is clear.
- T6.9 Confirm `pnpm knip:production` does not flag the new files as unused.

**Acceptance:**

- All success_condition commands pass: `pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint`.
- Unit-to-integration ratio respects `5-test-pyramid.md`: most tests are unit; one integration covers the round-trip.
- Coverage of the new files is comparable to neighboring use-cases in `src/application/use-cases/plugin/`.

**Validation:** `pnpm test && pnpm typecheck && pnpm knip:production && pnpm lint && pnpm build`.

**Commit boundary:** "test(plugin-create): unit + integration coverage + CHANGELOG (#214 part 6)".

---

## Expected commit graph

1. `feat(domain): scaffold helpers, PluginComponentKind, marketplace-json format (#214 part 1)`
2. `feat(use-case): PluginCreateUseCase (#214 part 2)` *(may merge with part 1)*
3. `feat(infra): JsonSchemaValidator port + AjvSchemaValidatorAdapter + bundled schema (#214 part 3)`
4. `feat(cli): aidd plugin create command (#214 part 4)`
5. `feat(use-case): marketplace.json append flow (#214 part 5)` *(may merge with part 2)*
6. `test(plugin-create): unit + integration coverage + CHANGELOG (#214 part 6)`

Minimum atomic count: 3 commits (parts 1+2+5 together, part 3 alone, part 4 alone, part 6 alone). Recommended: 4–5 commits.

---

## Risk callouts

### R1 — Schema fetch vs bundle (resolved in D1)

Bundle is chosen. Residual risk: upstream schema drift makes our generated manifest fail elsewhere. **Mitigation:** the optional schema-drift integration test (C1) — implement if Phase 6 has time. Pre-flight check in Phase 3 (T3.4) confirms the schema's required set at vendoring time and is the minimum required mitigation.

### R2 — Marketplace.json shape correctness (verified at planning)

The framework's `marketplace.json` shape was inspected at planning time (file at `/Users/baptistelafourcade/Projects/freelance/aidd/aidd/framework/.claude-plugin/marketplace.json`). Confirmed fields on each entry: `name`, `version`, `source`, `description`, `strict`, `recommended`. The schemastore URL for marketplace is `https://json.schemastore.org/claude-code-marketplace.json` (different from the plugin manifest schema). We do NOT validate the marketplace.json against its schema in this ticket — that's a separate concern; we just append a well-shaped entry. The pure helper `appendPluginToMarketplace` round-trips JSON without adding fields, preserving any extra fields a user has hand-added.

### R3 — Marketplace name collision (resolved in D3)

Fail loud with actionable message. Risk: a chatty error in an otherwise-successful scaffold path. Mitigation: the scaffold itself still lands; only the marketplace step rolls back. Command's success display calls this out explicitly.

### R4 — `--force` rm -rf semantics (resolved in D6)

Spec is explicit: rm -rf. Risk: author surprise. Mitigation: log line before deletion (`Overwriting existing directory <path>.`). No additional confirmation prompt — `--force` is the confirmation.

### R5 — `FileAdapter.writeFile` and parent-dir creation

`FileWriter` declares `writeFile(path, content): Promise<void>` and `createDirectory(path): Promise<void>` separately. Verify in `src/infrastructure/adapters/file-adapter.ts` whether `writeFile` auto-creates parents. If not, the scaffold loop must `createDirectory(dirname)` before each write. **Implementer task (Phase 2):** read the adapter, confirm, adjust the use-case if needed.

### R6 — `AssetProvider` extension surface

`AssetProvider` port is 402B (~10 lines). Verify the existing port has an extensible asset-load API or accept that we add one method for the schema. If extension is intrusive, an acceptable fallback is to inline `import schema from "../assets/schemas/claude-code-plugin-manifest.json" assert { type: "json" };` in the ajv adapter and skip the port. Trade-off: tighter coupling vs cleaner test seam. **Default position:** extend the port with `loadPluginManifestSchema(): Promise<object>`. **Fallback:** direct JSON import in the adapter with TypeScript JSON modules — keeps the test seam at `JsonSchemaValidator` instead. Either is acceptable; document the choice in the implementer's first commit.

### R7 — Bundle size impact

Adding `ajv` + `ajv-formats` increases the published bundle. `pnpm build:check-size` will fail loud if the budget is exceeded. Plan B if it does: use a smaller validator like `@cfworker/json-schema` (zero-dep, smaller). Plan C: rely on TypeScript types only for the in-memory `plugin.json` shape and skip runtime validation. Plan C **does not satisfy AC#5** ("Generated plugin.json validates against schemastore schema"), so it's only acceptable if both A and B fail.

### R8 — `<cwd>` semantics

The brief says "`<cwd>/.claude-plugin/marketplace.json`" but the codebase uses `projectRoot` as the resolved project root. These are normally identical (commander runs from cwd), but `parseGlobalOptions` may resolve to a different root via the `--project-root` global option. Decision: use `projectRoot`, matching every other command in `plugin.ts`. Document this so the test suite sets `projectRoot = tmpdir`, not relying on `process.cwd()` shimming.

---

## Open verification tasks for the implementer (P1 before coding)

1. Read `src/infrastructure/adapters/file-adapter.ts` and confirm whether `writeFile` auto-creates parent dirs. Adjust use-case accordingly (R5).
2. Read `src/domain/ports/asset-provider.ts` and `src/infrastructure/assets/asset-loader.ts` to decide between extending the port vs direct JSON import (R6).
3. Re-fetch the live schemastore plugin manifest schema; confirm `required: ["name"]` still holds; bundle the current version with a refresh-date header in the sibling README.md (T3.4 / D1).
4. Confirm `pnpm build:check-size` does not blow the budget after adding ajv + ajv-formats (R7).

None of these block planning. All are concrete reads / installs the implementer does in the first hour of Phase 1 or Phase 3.

---

## Final notes

- The "Notes" section of the spec calls this a rename from `scaffold` → `create`. Confirmed no existing `aidd plugin scaffold` subcommand exists in `src/application/commands/plugin.ts` — nothing to deprecate.
- Related epic: #172 (Phase 3 — Plugin Author DX). This ticket is one piece; #77 (`aidd plugin lint`) and #216 (`aidd marketplace create`) are siblings, neither blocking nor blocked by #214.
- Do not invoke or stub `pluginLintUseCase` anywhere; #77 is out of scope and adding placeholder calls would violate `7-clean-code.md` (no stub methods for future milestones).

## Plan deviations

- **Schema location**: The plan specified `src/infrastructure/assets/schemas/` as the bundled schema path (M7). The schema was placed at the project-root `assets/schemas/` location (matching the existing convention for all other bundled assets). The `BundledAssetProviderAdapter` retains a two-candidate lookup — `../../../assets/schemas/claude-code-plugin-manifest.json` (resolves correctly from the TypeScript source at `src/infrastructure/assets/`) AND `./claude-code-plugin-manifest.json` (resolves correctly from `dist/cli.js` after `tsup`'s `onSuccess` copies the schema to `dist/`). The second candidate is NOT dead: it is required for production resolution. The reviewer's F7 finding ("drop the dead `./claude-code-plugin-manifest.json` candidate") was incorrect. The loader was refactored to extract a `readSchemaFromDisk()` private method for clarity, but both candidates are retained. No functional impact on the schema contract.
- **Phase 3 + Phase 4 commit fold**: The Phase 3 commit (scaffold helpers, PluginComponentKind) also included Phase 4 wiring (AjvSchemaValidatorAdapter, runtime schema load, plugin create command). Both phases landed in a single commit (`feat(plugin): ...`) for atomic delivery. No functional impact.
