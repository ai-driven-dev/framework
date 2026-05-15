# CLI v5 Review Inventory

Audited branch: `feat/plugin-architecture` (post v5 cleanup merge). Date: 2026-05-07.

## Summary

- Rules: 26 total, 4 with stale/obsolete symbols, 13 need scoping or improved scope, 2 with structural prose violations
- Docs: 4 stale sections (project_brief.md heavily outdated, codebase_map.md partly stale, architecture.md stale sentence, CONTRIBUTING.md stale manual test block)
- Architecture: 12 findings (hi: 5 / med: 5 / lo: 2)

---

## Axis 1 — Rules

### A. Obsolescence

| Rule | Stale references | Action |
|---|---|---|
| `.claude/rules/00-architecture/0-command-thin-wrapper.md` line 9, 45 | `resolveFramework()` / `frameworkPath` / `version` — function does not exist in `src/` | Remove `resolveFramework()` from the template; the function no longer exists; commands call use-cases directly with `SetupFlow` or flags |
| `.claude/rules/00-architecture/0-post-install-pipeline.md` lines 11-12, 16 | `MemoryScriptUseCase` — class was deleted; actual pipeline is `manifestRepo.save → CatalogUseCase → GitignoreUseCase` (3 steps, no MemoryScript step 1) | Rewrite pipeline steps: drop step 1 (MemoryScriptUseCase); update `InitUseCase` exception text accordingly |
| `.claude/rules/06-design-patterns/6-shared-use-cases.md` line 18 | `MemoryScriptUseCase → manifestRepo.save → CatalogUseCase → GitignoreUseCase` — MemoryScriptUseCase deleted | Same fix: drop MemoryScriptUseCase from the canonical sequence |
| `.claude/rules/06-design-patterns/6-shared-use-cases.md` lines 20-24 | `SetupStateService` with states `needs-adopt`, `needs-install`, `needs-update`, `up-to-date`, `needs-init` — service does not exist in `src/`; `AdoptUseCase` (`needs-adopt`) was deleted; `SetupUseCase` emits only `initialized` / `up-to-date` | Remove the `SetupStateService` sub-section entirely; states are now handled inline in `SetupUseCase.execute()` |
| `.claude/rules/08-domain/8-manifest.md` lines 36, 38 | `Writable: docsDir, repo` and `--repo flag > AIDD_REPO env > manifest repo field > default` — `docsDir` and `repo` were removed from manifest v5 schema | Delete the "Field ownership" section; v5 manifest has no writable config fields |
| `.claude/rules/08-domain/8-value-objects.md` line 76 | `MemoryCapability → src/domain/capabilities/memory-capability.ts` — file does not exist in `src/domain/capabilities/` (deleted in refactor) | Remove the `MemoryCapability` row from the canonical locations table |
| `.claude/rules/00-architecture/0-hexagonal.md` line 9 | `domain/capabilities/ — capability classes (agents, commands, hooks, mcp, memory, rules, settings, skills)` — `memory` capability deleted | Remove `memory` from the list; add `plugins` (file exists: `plugins-capability.ts`) |
| `.claude/rules/00-architecture/0-tool-config.md` line 13 | `capabilities/ — ... memory-capability.ts` — deleted | Remove `memory-capability.ts` from the list; add `plugins-capability.ts` |

### B. Scope

| Rule | Current `paths:` | Recommended `paths:` | Rationale |
|---|---|---|---|
| `00-architecture/0-command-thin-wrapper.md` | global (none) | `src/application/commands/**/*.ts` | Only relevant when writing commands |
| `00-architecture/0-deps-wiring.md` | global (none) | `src/application/commands/**/*.ts, src/cli.ts, src/infrastructure/deps.ts` | Only concerns wiring files |
| `00-architecture/0-discriminant-types.md` | `src/application/use-cases/**/*.ts` | Keep (correct) | Already scoped |
| `00-architecture/0-error-handling.md` | `src/**/*.ts` | Keep (correct, universal to all src) | Cross-cutting concern |
| `00-architecture/0-hexagonal.md` | `src/**/*.ts` | Keep (correct) | Layer rules apply to all src files |
| `00-architecture/0-layer-responsibilities.md` | `src/**/*.ts` | Acceptable; could narrow to `src/application/**/*.ts, src/domain/**/*.ts, src/infrastructure/**/*.ts` | Near-universal; keep broad |
| `00-architecture/0-port-design.md` | `src/domain/ports/**/*.ts, src/infrastructure/adapters/**/*.ts` | Keep (correct) | Already scoped |
| `00-architecture/0-post-install-pipeline.md` | `src/application/use-cases/**/*.ts` | Keep (correct) | Already scoped |
| `00-architecture/0-tool-config.md` | `src/domain/tools/**/*.ts, src/domain/capabilities/**/*.ts, src/domain/formats/**/*.ts` | Keep (correct) | Already scoped |
| `01-standards/1-exports.md` | `src/**/*.ts` | Keep (correct) | Universal |
| `01-standards/1-naming.md` | `src/**/*.ts` | `src/**/*.ts, tests/**/*.ts` | Test files also need naming conventions |
| `02-programming-languages/2-typescript.md` | `src/**/*.ts, tests/**/*.ts` | Keep (correct) | Already broad-correct |
| `03-frameworks-and-libraries/3-cli-output.md` | `src/application/**/*.ts` | Keep (correct) | Already scoped |
| `03-frameworks-and-libraries/3-commander.md` | `src/application/commands/**/*.ts, src/cli.ts` | Keep (correct) | Already scoped |
| `04-tooling/4-biome.md` | `src/**/*.ts, tests/**/*.ts` | Keep (correct) | Linting applies to all TS |
| `04-tooling/4-git-hooks.md` | global (none) | `lefthook.yml` | Only relevant when editing hooks config |
| `05-testing/5-test-pyramid.md` | `tests/**/*.test.ts` | Keep (correct) | Already scoped |
| `06-design-patterns/6-adapter.md` | `src/infrastructure/adapters/**/*.ts` | Keep (correct) | Already scoped |
| `06-design-patterns/6-capability-sub-use-cases.md` | `src/application/use-cases/**/*.ts, src/domain/tools/**/*.ts` | Keep (correct) | Already scoped |
| `06-design-patterns/6-method-size.md` | `src/application/use-cases/**/*.ts, src/domain/**/*.ts` | Keep (correct) | Already scoped |
| `06-design-patterns/6-shared-use-cases.md` | `src/application/use-cases/**/*.ts` | Keep (correct) | Already scoped |
| `06-design-patterns/6-use-case.md` | `src/application/use-cases/**/*.ts` | Keep (correct) | Already scoped |
| `07-quality/7-auth.md` | `src/infrastructure/auth/**/*.ts, src/application/use-cases/**/*.ts` | Keep (correct) | Already scoped |
| `07-quality/7-clean-code.md` | `src/**/*.ts, tests/**/*.ts` | Keep (correct) | Universal |
| `08-domain/8-manifest.md` | `src/domain/models/manifest.ts, src/application/use-cases/**/*.ts` | Keep (correct) | Already scoped |
| `08-domain/8-value-objects.md` | `src/domain/models/**/*.ts, src/application/use-cases/**/*.ts` | Keep (correct) | Already scoped |

**Rules that need scope added:**
- `0-command-thin-wrapper.md` — add `paths: [src/application/commands/**/*.ts]`
- `0-deps-wiring.md` — add `paths: [src/application/commands/**/*.ts, src/cli.ts, src/infrastructure/deps.ts]`
- `4-git-hooks.md` — add `paths: [lefthook.yml]`

### C. Duplication / verbosity

- `0-command-thin-wrapper.md` and `0-layer-responsibilities.md` (command section) overlap significantly on "wire only: create deps → call use-case → display result" guidance. The template in `0-command-thin-wrapper.md` is the canonical form; `0-layer-responsibilities.md`'s Command section is a condensed restatement. Consider removing the Command section from `0-layer-responsibilities.md` and keeping only the Use Case / Domain / Port / Adapter sections there.
- `0-post-install-pipeline.md` and `6-shared-use-cases.md` both list the same pipeline steps. One source of truth is sufficient. Proposal: keep the step list only in `0-post-install-pipeline.md` and reference it from `6-shared-use-cases.md`.
- `6-use-case.md` and `6-shared-use-cases.md` both state the constructor injection order. Keep it in one place (`6-use-case.md`).
- `6-method-size.md` and `6-use-case.md` / `0-layer-responsibilities.md` all include the ≤20-line constraint. Acceptable level of duplication since it is a hard invariant; no action needed.

### D. Structure conformity

Rules not following the "bullet points only, 3-7 words per bullet" standard from `01-standards/1-rule-writing.md`:

- `0-command-thin-wrapper.md` — contains a multi-line TypeScript template block. The code block is useful as a concrete example but should be treated as an appendix/example, not as a required structural element of the rule. The prose intro sentences and the "FORBIDDEN" section exceed the 3-7 word limit.
- `0-layer-responsibilities.md` — uses full prose bullets like "Orchestrate domain operations end-to-end" (5 words, acceptable) and longer ones like "No tool-specific logic — tool names (`opencode`, `cursor`, etc.), tool file names, or per-tool decisions must not appear here" (clearly >7 words). Trim.
- `6-use-case.md` — "User file protection" section is prose. The "Constructor injection order" is a long one-liner. Convert to bullets.
- `6-shared-use-cases.md` — "SetupStateService" sub-section should be removed after cleaning the stale content (see A).

---

## Axis 2 — Documentation

### README.md

**Status: Accurate for v5 noun-first surface.** No stale commands found (the command table and sections all use `aidd ai install`, `aidd ide install`, etc.).

**One issue:** Line 227 still shows `aidd setup --source local --path /path/to/framework` — `--path` flag is valid (it exists in `setup.ts` line 117), so this is NOT stale.

**One issue:** Line 316 `aidd plugin install my-plugin --from acme` — check if `--from` flag was removed. The audit found `--from` referenced in removal list but `--plugin install --from` is a different flag scope from `setup --from`. Recommend verifying `--from` on `plugin install` still works before marking stale.

**No action required on README.md** — it accurately reflects v5 surface.

### ARCHITECTURE.md

**Status: Mostly accurate but has minor gaps.**

**Issue 1 (line 14):** Use-case subdirs list says `ai/ ide/ marketplace/ plugin/ shared/` but actual dirs are `auth/ global/ install/ marketplace/ migrate/ plugin/ restore/ setup/ shared/ sync/`. The listing misses `auth/`, `global/`, `install/`, `migrate/`, `restore/`, `setup/`, `sync/`.

**Issue 2 (line 30):** `tar/` is listed in infrastructure subdirs but `src/infrastructure/tar/` is empty (only `.gitkeep`). Remove `tar/` from the listing or note it is reserved.

**Issue 3 (line 30):** `cache/` is listed but `src/infrastructure/cache/` is also empty (only `.gitkeep`). Same treatment as `tar/`.

**No stale symbol references found** in ARCHITECTURE.md. The `Manifest (v5)` description (line 45) is accurate. The `Plugin Architecture` and `Dependency Wiring` sections are correct.

### CHANGELOG.md

**Status: Good.** The `[4.1.0-beta.11]` section is a well-structured breaking change entry with a migration table. All removed flags and commands are listed. No action needed.

### CONTRIBUTING.md

**Issue (lines 119-128):** The "Test the CLI manually" section still shows the old verb-first commands:

```
aidd init
aidd install
aidd install claude
aidd install claude cursor
aidd install --force
```

These commands no longer exist. The v5 equivalents are `aidd setup` and `aidd ai install <tool>`. This section needs a rewrite.

**Issue (line 156 in commit examples):** `docs: update adopt command examples` — a stale example commit message referencing the deleted `adopt` command. Minor cosmetic issue; low priority.

**Issue (line 38):** `For full details: aidd_docs/memory/architecture.md` — that memory file contains a stale `FrameworkResolver` sentence (see below). The link is valid but the destination is partially stale.

### aidd_docs/memory/architecture.md

**Issue (line 55):** `**Framework resolver** (\`FrameworkResolver\`) is still used by \`setup\` — being phased out in the marketplace-only refactor.` — `FrameworkResolver` was deleted. This sentence must be removed.

**Issue (lines 63):** `Runtime configs, memory stubs, and IDE configs ship inside the CLI binary` — memory stubs are no longer bundled (moved to `aidd-context` plugin). Update to: `Runtime configs and IDE configs ship inside the CLI binary`.

### aidd_docs/memory/codebase_map.md

**Issue (line 11):** `adopt/` subdir listed under use-cases — `AdoptUseCase` was deleted; the `adopt/` directory does not exist.

**Issue (line 13):** `install/` sub-use-cases list includes `memory-stub` — deleted capability.

**Issue (line 63):** Tests section: `mock Prompter + FrameworkResolver only` — `FrameworkResolver` is deleted; test helpers no longer include it.

**Issue (lines 38, 42):** `cache/` and `migrations/` listed as infrastructure subdirs — both exist as empty directories (`.gitkeep` only); content has moved or was removed. Note as empty/reserved or remove.

### aidd_docs/memory/project_brief.md

**Heavily stale (entire Commands table, lines 38-53):** Describes the pre-v5 command surface with `aidd install`, `aidd cache list/clear`, `aidd config list/get/set`, removed flags (`--release`, `--path`, `--all-tools`, `--docs-dir`, `--from`, `--mcp`), and the old global `--repo` flag. This entire table needs a full rewrite against the v5 command surface.

### aidd_docs/memory/testing.md

**Issue (lines 32, 71):** `mock only: Prompter and FrameworkResolver` — `FrameworkResolver` is deleted; the pattern is `mock only ports via in-memory implementations from tests/helpers/ports/`.

---

## Axis 3 — Architecture

### A. Layer compliance

**No violations found.** `src/domain/` has zero imports from `application/` or `infrastructure/`. No `node:fs` or `process.env` reads in domain. Application use-cases do not import adapters directly. `src/cli.ts` has minimal business logic — only `formatVersion()` helper (3 lines, acceptable) plus the update banner call in `preAction`.

**One minor observation:** `src/cli.ts` calls `createDeps()` in the `preAction` hook (line 55), which runs after `program.parse()` — this is correct per the `0-deps-wiring.md` rule. However, `createMenuDeps()` is called inside command action handlers in `ai.ts`, `ide.ts`, `plugin.ts`, `marketplace.ts` — the rule states `createMenuDeps only before program.parse()` but the intent is clearly "for pre-parse interactive input resolution." The rule text needs clarification that `createMenuDeps` is also valid inside action handlers when prompting for missing interactive inputs.

### B. Aggregate/value object inventory

**Aggregates:**
- `Manifest` — rich aggregate; `isFileTracked()`, `addEntry()`, `removeEntries()`, etc.
- `SetupFlow` — value object with `.equals()`
- `MigrationPlan` — aggregate with `.equals()`
- `MarketplaceEntry` — value object with `.equals()`
- `MarketplaceCacheEntry` — value object with `.equals()`
- `Plugin` — entity
- `PluginDistribution` — value object (1 method — thin; acceptable)
- `Marketplace` — entity with `.withLastFetched()`
- `FileHash` — value object with `.equals()`

**Flags:**
- `Plugin` — no `.equals()`. If plugins are ever compared or deduplicated, this will need adding.
- `PluginDistribution` — only 1 non-constructor method (`getComponent()`). Near-anemic; acceptable for a read-only value container.
- `FileSystem` port — **14 methods** (violates `≤5 methods per port` rule from `0-port-design.md`). This is the most significant port design violation. Consider splitting: `FileReader` (read/exists/list/hash), `FileWriter` (write/delete/create/chmod), `FileMerger` (merge, backup, hasLocalChanges).

**Port design violation detail:**
`src/domain/ports/file-system.ts` has 14 methods:
`writeFile`, `deleteFile`, `createDirectory`, `deleteEmptyDirectories`, `readFile`, `listDirectory`, `fileExists`, `readFileHash`, `mergeJsonFile`, `deleteDirectory`, `chmodExecutable`, `backup`, `hasLocalChanges`, `listFilesRecursive`. The rule caps ports at 5 methods. This is a known pragmatic trade-off but should be flagged.

### C. Naming inconsistency

- `src/application/use-cases/check-update-use-case.ts` — exports `printUpdateBanner` as a plain `async function`, not a class. Rule `6-use-case.md` requires "always a class." File name has `-use-case.ts` suffix but is not a use-case class. Low severity since it's a utility called only from `cli.ts`.
- `src/application/use-cases/shared/resolve-restore-decision.ts` — exports `resolveRestoreDecision` as a plain `async function`, not a class. Same violation. Consider renaming the file to `restore-decision.ts` (removing `-use-case` implication) and keeping as a domain helper function, or converting to a class.
- `src/application/use-cases/plugin/plugin-helpers.ts` — not a use-case, correctly named as `plugin-helpers.ts`. Multiple callers (4). No issue.
- All adapter files follow `*-adapter.ts` convention. All port files match their interface name. No further violations.

### D. Dead/redundant abstractions

- `src/infrastructure/cache/` and `src/infrastructure/tar/` — both are empty (`.gitkeep` only). If `cache/` was for framework tarball caching (removed), the directory is dead. If it still has a purpose for marketplace cache, that adapter (`marketplace-cache-adapter.ts`) lives in `adapters/`, not `cache/`. Recommend removing both dead directories.
- No use-cases found that simply forward to one other use-case (no trivial delegators to collapse).
- No helpers with only one caller found (plugin-helpers has 4 callers; all others are standard use-case classes).

### E. Test infrastructure

- `tests/helpers/ports/` contains all in-memory port implementations. Production has 19 ports; test helpers cover: `FileSystem` (in-memory-file-system.ts), `ManifestRepository` (in-memory-manifest-repository.ts), `MarketplaceCache` (in-memory-marketplace-cache.ts), `MarketplaceRegistry` (in-memory-marketplace-registry.ts), `MarketplaceTrustStore` (in-memory-marketplace-trust-store.ts), `Prompter` (scripted-prompter.ts), `Hasher` (deterministic-hasher.ts), `Logger` (capturing-logger.ts), `PluginFetcher` (fixture-plugin-fetcher.ts), `AuthReader` (fake-auth-reader.ts), `VersionReader` (fake-current-version.ts), `Platform` (fake-platform.ts). Missing in-memory implementations: `PluginCatalogRepository`, `PluginDistributionReader`, `CredentialStore`, `TokenProvider`, `OauthProvider`, `VersionControl`, `SelfUpdater`, `AssetProvider`. Tests likely instantiate real adapters or skip coverage for those. Low concern unless test coverage gaps are found.
- `tests/e2e/E2E_MAP.md` line 349 references `needs-adopt state` (deleted concept). `tests/e2e/E2E_RESULTS.md` line 323 references `FrameworkLoaderAdapter` (deleted). These are documentation files, not test code — no false test failures, but they are stale doc.

---

## Prioritized action list

### HIGH

1. **`0-post-install-pipeline.md` + `6-shared-use-cases.md`: Remove `MemoryScriptUseCase` from pipeline steps.** The rule actively misdirects contributors to include a deleted class in future pipeline work. Both files reference it; update both to reflect the 3-step sequence: `manifestRepo.save → CatalogUseCase → GitignoreUseCase`. Also remove the `InitUseCase` exception text referencing step 1.

2. **`6-shared-use-cases.md`: Remove `SetupStateService` sub-section entirely.** `SetupStateService` and `needs-adopt` state do not exist in the codebase. Any contributor following this rule will search for a non-existent class and write incorrect code.

3. **`8-manifest.md`: Remove the "Field ownership" section** (`Writable: docsDir, repo` + framework repo resolution via `--repo` flag). These fields were removed in v5; the rule contradicts the actual `Manifest` class and the v5 schema.

4. **`aidd_docs/memory/project_brief.md`: Full rewrite of the Commands table** (lines 38-53). The entire table describes the pre-v5 surface with deleted commands and flags. This is the most-used memory file and it will mislead every AI-assisted development session.

5. **`CONTRIBUTING.md`: Update "Test the CLI manually" section** (lines 119-128). Replace old `aidd init` / `aidd install` commands with `aidd setup` / `aidd ai install <tool>`. This is user-facing onboarding documentation.

### MEDIUM

6. **`8-value-objects.md` + `0-hexagonal.md` + `0-tool-config.md`: Remove `MemoryCapability` references.** The file `src/domain/capabilities/memory-capability.ts` does not exist. Listing it in the canonical locations table causes confusion. Also add `plugins-capability.ts` (which does exist) to the capability list in `0-hexagonal.md` and `0-tool-config.md`.

7. **`0-command-thin-wrapper.md`: Remove `resolveFramework()` from template.** The function does not exist in `src/`; the rule's code template shows a call that will fail to compile. Remove the `resolveFramework(...)` line from the template.

8. **`aidd_docs/memory/codebase_map.md`: Remove `adopt/` and `memory-stub` from the use-cases map** and update the test section to remove `FrameworkResolver`. Add missing subdirs: `global/`, `migrate/`, `setup/`, `restore/`.

9. **`aidd_docs/memory/architecture.md`: Remove the stale `FrameworkResolver` sentence** (line 55) and update "memory stubs" text (line 63) to reflect they are no longer bundled.

10. **`FileSystem` port: Document the known ≤5-method exception.** `src/domain/ports/file-system.ts` has 14 methods, violating `0-port-design.md`. Either add a comment in the port file noting this is a deliberate exception, or add an exception note in `0-port-design.md`. A full split into sub-ports would be a medium-complexity refactor; tracking it is more appropriate than silently violating the rule.

### LOW

11. **`check-update-use-case.ts` and `resolve-restore-decision.ts`: Rename or convert to classes.** Both export plain `async function` exports from files with `-use-case.ts` suffixes. Rule `6-use-case.md` requires classes. Low risk since they are internal helpers, but the naming creates confusion.

12. **`src/infrastructure/cache/` and `src/infrastructure/tar/`: Remove empty directories** (only `.gitkeep`). The framework tarball download (tar extraction, version caching) was removed in the marketplace-only architecture. The empty dirs are dead artifacts. Also update `ARCHITECTURE.md` and `codebase_map.md` to remove these from the infrastructure listing.

13. **`0-command-thin-wrapper.md` + `0-deps-wiring.md`: Add `paths:` frontmatter** to prevent these rules from loading on every file. Suggested scopes: `src/application/commands/**/*.ts` and `lefthook.yml` respectively.

14. **`aidd_docs/memory/testing.md`: Replace `mock Prompter + FrameworkResolver` with current pattern** (`mock ports via tests/helpers/`).

15. **`tests/e2e/E2E_MAP.md` and `E2E_RESULTS.md`: Update stale references** (`needs-adopt state`, `FrameworkLoaderAdapter`). Low priority since these are doc files, not test code.
