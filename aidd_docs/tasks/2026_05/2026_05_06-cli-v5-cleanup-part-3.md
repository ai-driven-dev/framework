# Phase 3 — Setup orchestrator rewrite

> Rewrite `SetupUseCase` as a thin orchestrator chaining sub-use-cases. Remove `AdoptUseCase` call, `FrameworkResolver` port usage, `manifest.mode` reads, and legacy flag branches. This unblocks Phase 4's co-deletion of the `adopt/` directory, `DistributionMode`, and `FrameworkResolverAdapter`.

## Pre-requisites

- Phase 2 (install legacy purge) landed — `--from/--switch-mode/--mode/--path/--release` flags already stripped from `setup.ts`, `ResolveFrameworkUseCase` already deleted

## Goal

`setup-use-case.ts` is ~18KB with dead branches: adopt flow (lines 23 import, 414 call), mode-switch logic, FrameworkResolver port dependency (lines 7, 76), `manifest.mode` reads (lines 185, 187, 282–295), and `manifest.repo` read (line 345). Rewrite as a clean orchestrator for the marketplace-only setup flow. This is the critical unblocking phase: once `SetupUseCase` no longer imports `AdoptUseCase`, the `adopt/` directory has zero callers and Phase 4 can delete it.

## Architecture compliance

### SetupFlow aggregate root

`SetupFlow` value object encodes the full orchestration intent. The command builds a `SetupFlow`, the use-case consumes it — no prompter calls inside the orchestrator itself for input collection. Sub-use-cases (`SetupMarketplaceSourceUseCase`, `SetupPluginsPromptUseCase`) are the only places Prompter is called, and only when `interactive: true`.

```
SetupUseCase (orchestrator)
├── SetupMarketplaceSourceUseCase   (src/application/use-cases/setup/)
├── MarketplaceRegisterFrameworkUseCase (existing)
├── MarketplaceRefreshUseCase (existing)
├── SetupToolsUseCase               (src/application/use-cases/setup/)
│   ├── InstallRuntimeConfigUseCase (existing)
│   └── InstallIdeConfigUseCase (existing)
└── SetupPluginsPromptUseCase       (src/application/use-cases/setup/)
    └── PluginPickUseCase (existing) — interactive only
```

Domain pure: `SetupFlow` and `MarketplaceSourceMode` live in `src/domain/models/` with no imports from application or infrastructure. Methods ≤20 lines; private helpers extracted per step.

## Steps

### A. Create domain models

- [ ] Create `src/domain/models/marketplace-source-mode.ts`:
  - Discriminated union: `{ kind: "remote"; url: string } | { kind: "local"; path: string }`
  - Factory `MarketplaceSourceMode.remote(url?)` — defaults to `https://github.com/ai-driven-dev/aidd-framework.git`
  - Factory `MarketplaceSourceMode.local(path)` — validates path is absolute
  - `.equals()` method
  - Ctor throws on invalid path (empty string, relative path)
- [ ] Create `src/domain/models/setup-flow.ts`:
  - Aggregate constructor accepts params object
  - Validates: source required; tool IDs valid; plugin mode coherent with `pluginNames`
  - Methods: `isScriptable()`, `hasAnyTool()`, `equals()`
  - Readonly fields only

### B. Create sub-use-cases in `src/application/use-cases/setup/`

- [ ] `setup-marketplace-source-use-case.ts`:
  - Input: `{ projectRoot, sourceFromCli?, interactive }`
  - If `sourceFromCli` provided → return as-is
  - Else if `interactive` → prompt user (remote default vs local path)
  - Else → throw `MissingMarketplaceSourceError`
  - Returns `MarketplaceSourceMode`
- [ ] `setup-tools-use-case.ts`:
  - Input: `{ projectRoot, manifest, aiTools, ideTools, force, version }`
  - Loops AI tools → calls `InstallRuntimeConfigUseCase` per tool
  - Loops IDE tools → calls `InstallIdeConfigUseCase` per tool
  - Returns `SetupToolsResult` with per-tool outcomes
- [ ] `setup-plugins-prompt-use-case.ts`:
  - Input: `{ projectRoot, mode: PluginInstallMode, pluginNames, interactive }`
  - `mode === "none"` → no-op
  - `mode === "interactive"` AND `interactive` → call `PluginPickUseCase`
  - `mode === "all" | "recommended" | "named"` → resolve plugin list + call `PluginInstallFromMarketplaceUseCase` per plugin
  - Else (non-TTY, interactive-mode) → no-op

### C. Rewrite `src/application/use-cases/setup-use-case.ts`

- [ ] Remove import of `AdoptUseCase` at line 23 — this is the blocker for Phase 4 `adopt/` deletion
- [ ] Remove call to `AdoptUseCase` at line 414
- [ ] Remove `AdoptRequiresVersionError` throw blocks at lines 438, 471, 478
- [ ] Remove `FrameworkResolver` port dependency at lines 7 (import), 76 (ctor injection)
- [ ] Remove `manifest.mode` reads at lines 185, 187, 282–295 (`getMode`, `setMode` calls)
- [ ] Remove `manifest.repo` read at line 345
- [ ] New constructor injects: `fs, manifestRepo, logger, prompter, setupMarketplaceSource, marketplaceRegisterFramework, marketplaceRefresh, setupTools, setupPluginsPrompt, currentVersionProvider`
- [ ] `execute(flow: SetupFlow)` orchestrates 6 steps: resolve source → init manifest → register marketplace → refresh catalog → install tools → prompt plugins
- [ ] Returns `SetupResult` discriminated union: `{ kind: "initialized"; ... } | { kind: "up-to-date"; ... }`
- [ ] Drop result kinds: `adopted`, `installed` (legacy fetch), `mode-switched`
- [ ] Each step extracted to private method ≤20 lines

### D. Rewrite `src/application/commands/setup.ts`

- [ ] Parse new flags: `--source remote|local`, `--path <dir>` (only with `--source local`), `--ai <ids>`, `--ide <ids>`, `--all`, `--plugins <names>`, `--all-plugins`, `--recommended-plugins`, `--no-plugins`, `--yes`
- [ ] Validate flag combinations: source=local requires `--path`; mutually exclusive plugin flags error early
- [ ] Build `SetupFlow` from flags + `process.stdout.isTTY`
- [ ] Call one use-case: `SetupUseCase.execute(flow)`
- [ ] Display result based on `kind`

### E. Update `deps.ts`

- [ ] Wire new sub-use-cases: `setupMarketplaceSourceUseCase`, `setupToolsUseCase`, `setupPluginsPromptUseCase`
- [ ] Remove `FrameworkResolver` port instantiation from `SetupUseCase` construction path
- [ ] `InstallFrameworkPluginsUseCase` still wired (deleted in Phase 5) — do not remove yet

## Tests (unit-first)

### Unit tests

- [ ] `tests/domain/models/marketplace-source-mode.unit.test.ts` — every factory, invalid path throw, `.equals()`
- [ ] `tests/domain/models/setup-flow.unit.test.ts` — every invariant: source required, invalid tool IDs, plugin mode coherence, `isScriptable()`, `hasAnyTool()`
- [ ] `tests/application/use-cases/setup/setup-marketplace-source-use-case.unit.test.ts` — interactive vs scripted vs missing-flag-non-interactive
- [ ] `tests/application/use-cases/setup/setup-tools-use-case.unit.test.ts` — empty / AI-only / IDE-only / mixed / failure propagation
- [ ] `tests/application/use-cases/setup/setup-plugins-prompt-use-case.unit.test.ts` — every PluginInstallMode branch
- [ ] `tests/application/use-cases/setup-use-case.unit.test.ts` — orchestration order, error propagation, idempotency on re-run; verify `AdoptUseCase` never invoked

### Integration tests

- [ ] `tests/application/use-cases/setup-use-case.integration.test.ts` — happy path with in-memory FS port + test-fixture marketplace; one scripted flow producing expected manifest on disk

### E2E tests

- One greenfield setup E2E test in Phase 12 (not here)

## Acceptance criteria

- [ ] `pnpm test tests/application/use-cases/setup` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `rg "AdoptUseCase|FrameworkResolver" src/application/use-cases/setup-use-case.ts` returns empty
- [ ] `aidd setup` (no args, TTY) prompts source / AI / IDE / plugins → succeeds
- [ ] `aidd setup --source remote --all --no-plugins --yes` succeeds without prompts
- [ ] `aidd setup --source local --path /abs/dir --ai claude --ide vscode --no-plugins --yes` succeeds
- [ ] `aidd setup --source local` (no path, non-TTY) errors with clear message
- [ ] No memory stub written to disk after `aidd setup --ai claude`
- [ ] Re-running `aidd setup` on installed project: idempotent

## Manual validation

```bash
cd /tmp && rm -rf greenfield && mkdir greenfield && cd greenfield

# Interactive
aidd setup
# expect: source prompt → AI checkbox → IDE checkbox → plugins prompt

# Scriptable minimal
rm -rf .aidd .claude .vscode .cursor .codex
aidd setup --source remote --yes

# Scriptable full
rm -rf .aidd .claude .vscode .cursor .codex
aidd setup --source remote --all --recommended-plugins --yes

# Non-TTY missing flags should fail
echo | aidd setup
```

## Risks / breaking changes

- Users scripting `aidd setup --mode local --path X` break (flags removed in Phase 2). Phase 3 introduces `--source local --path X`.
- Setup result discriminated union changes. No external consumers expected.
- `AdoptUseCase` removal means "adopt existing project" feature is gone. Re-introduce with marketplace semantics if needed in a future plan.

## Commit

```
refactor(setup): rewrite as orchestrator — drop adopt/mode/FrameworkResolver

Replace monolithic SetupUseCase with thin orchestrator chaining:
- SetupMarketplaceSourceUseCase (interactive vs scripted source resolution)
- MarketplaceRegisterFrameworkUseCase (existing)
- MarketplaceRefreshUseCase (existing)
- SetupToolsUseCase (loops InstallRuntimeConfig + InstallIdeConfig)
- SetupPluginsPromptUseCase (delegates to PluginPick or named install)

Remove AdoptUseCase import (setup-use-case.ts:23) and call (:414) — unblocks
adopt/ directory deletion in Phase 4.
Remove FrameworkResolver port deps (:7,:76) — unblocks FrameworkResolverAdapter
co-deletion in Phase 4.
Remove manifest.mode reads (:185,:187,:282-295) and manifest.repo read (:345).

Introduce SetupFlow aggregate and MarketplaceSourceMode value object.
New flags: --source remote|local, --path, --ai, --ide, --all, plugin mode flags, --yes.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-3.md
```
