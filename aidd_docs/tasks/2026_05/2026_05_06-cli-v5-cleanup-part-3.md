# Phase 3 — Setup orchestrator refactor

> Rewrite SetupUseCase as clean orchestrator chaining sub-use-cases. Drop legacy branches. Support both interactive UX and fully scriptable CI invocation.

## Pre-requisites

- Phase 1 (manifest v5) landed
- Phase 2 (suppressions) landed — legacy setup flags + `ResolveFrameworkUseCase` gone

## Goal

Today `setup-use-case.ts` is ~18KB with branches for adopt / mode-switch / from-version / framework-fetch — all dead post Phase 2. Rewrite as a thin orchestrator that:

1. Resolves marketplace source (interactive prompt OR scripted flag)
2. Initializes manifest v5 if absent
3. Registers default marketplace
4. Refreshes marketplace catalog
5. Installs selected AI tool runtime configs (no memory stub)
6. Installs selected IDE tool configs
7. (Interactive only) Prompts to install framework plugins → delegates to `PluginPickUseCase`

## Architecture compliance

### Aggregate root

`SetupFlow` value object captures the full orchestration state:

```ts
// src/domain/models/setup-flow.ts
export class SetupFlow {
  readonly source: MarketplaceSourceMode;       // value object: { kind: "remote", url } | { kind: "local", path }
  readonly aiTools: readonly AiToolId[];
  readonly ideTools: readonly IdeToolId[];
  readonly installPlugins: PluginInstallMode;   // value object: "all" | "recommended" | "named" | "none" | "interactive"
  readonly pluginNames: readonly string[];

  constructor(params: SetupFlowParams) { /* validate invariants */ }
  isScriptable(): boolean { /* derived */ }
  hasAnyTool(): boolean { /* derived */ }
}
```

### Use case structure

```text
SetupUseCase (orchestrator, src/application/use-cases/setup-use-case.ts)
├── SetupMarketplaceSourceUseCase (sub-uc, src/application/use-cases/setup/setup-marketplace-source-use-case.ts)
├── MarketplaceRegisterFrameworkUseCase (existing)
├── MarketplaceRefreshUseCase (existing)
├── SetupToolsUseCase (sub-uc, src/application/use-cases/setup/setup-tools-use-case.ts)
│   ├── InstallRuntimeConfigUseCase (existing) — for each AI tool
│   └── InstallIdeConfigUseCase (existing) — for each IDE tool
└── SetupPluginsPromptUseCase (sub-uc, src/application/use-cases/setup/setup-plugins-prompt-use-case.ts)
    └── PluginPickUseCase (existing) — interactive only
```

### Rules enforced

- Each use case ≤20 lines per method (extract private helpers)
- Sub-use-cases live in `src/application/use-cases/setup/`
- Commands stay thin — `setup.ts` only parses flags, builds `SetupFlow`, calls `SetupUseCase.execute(flow)`, displays result
- No prompter calls inside use-cases except `SetupMarketplaceSourceUseCase` and `SetupPluginsPromptUseCase` — those are explicitly interactive helpers and accept `interactive: boolean` flag (when false, throw if input missing)

## Steps

- [ ] Create `src/domain/models/marketplace-source-mode.ts`:
  - [ ] Discriminated union: `{ kind: "remote"; url: string } | { kind: "local"; path: string }`
  - [ ] Factory `MarketplaceSourceMode.remote(url?)` defaults to `https://github.com/ai-driven-dev/aidd-framework.git`
  - [ ] Factory `MarketplaceSourceMode.local(path)` validates path is absolute
  - [ ] Unit tests
- [ ] Create `src/domain/models/setup-flow.ts`:
  - [ ] Aggregate constructor accepts params object, validates: at least source set; tool ids valid; plugin mode coherent with `pluginNames`
  - [ ] Methods: `isScriptable()`, `hasAnyTool()`, `equals()`
  - [ ] Unit tests
- [ ] Create `src/application/use-cases/setup/setup-marketplace-source-use-case.ts`:
  - [ ] Input: `{ projectRoot, sourceFromCli?, interactive }`
  - [ ] If `sourceFromCli` provided → return as-is
  - [ ] Else if `interactive` → prompt user (remote default vs local path)
  - [ ] Else → throw `MissingMarketplaceSourceError`
  - [ ] Returns `MarketplaceSourceMode`
- [ ] Create `src/application/use-cases/setup/setup-tools-use-case.ts`:
  - [ ] Input: `{ projectRoot, manifest, aiTools, ideTools, force, version }`
  - [ ] Loops AI tools → calls `InstallRuntimeConfigUseCase`
  - [ ] Loops IDE tools → calls `InstallIdeConfigUseCase`
  - [ ] Returns aggregated `SetupToolsResult` with per-tool outcomes
- [ ] Create `src/application/use-cases/setup/setup-plugins-prompt-use-case.ts`:
  - [ ] Input: `{ projectRoot, mode: PluginInstallMode, pluginNames, interactive }`
  - [ ] If `mode === "none"` → no-op
  - [ ] If `mode === "interactive"` AND `interactive` → call `PluginPickUseCase`
  - [ ] If `mode === "all" | "recommended" | "named"` → resolve plugin list + call `PluginInstallFromMarketplaceUseCase` per plugin
  - [ ] Else → no-op (no prompt in non-TTY)
- [ ] Rewrite `src/application/use-cases/setup-use-case.ts`:
  - [ ] Constructor injects: `fs, manifestRepo, logger, prompter, setupMarketplaceSource, marketplaceRegisterFramework, marketplaceRefresh, setupTools, setupPluginsPrompt, currentVersionProvider, marketplaceRegistry, marketplaceSyncSettings`
  - [ ] `execute(flow: SetupFlow)` orchestrates 6 steps in order
  - [ ] Returns `SetupResult` discriminated union: `{ kind: "initialized"; ... } | { kind: "up-to-date"; ... }`
  - [ ] Drop all branches: `adopted`, `installed`, `mode-switched`
  - [ ] Each step extracted to private method ≤20 lines
- [ ] Rewrite `src/application/commands/setup.ts`:
  - [ ] Parse new flags: `--source remote|local`, `--path <dir>` (only with `--source local`), `--ai <ids>`, `--ide <ids>`, `--all`, `--plugins <names>`, `--all-plugins`, `--recommended-plugins`, `--no-plugins`, `--yes`
  - [ ] Validate flag combinations (source = local requires `--path`; mutually exclusive plugin flags)
  - [ ] Build `SetupFlow` from flags + interactivity
  - [ ] Call `SetupUseCase.execute(flow)`
  - [ ] Display result based on `kind`
- [ ] Update `deps.ts`:
  - [ ] Wire new sub-use-cases
  - [ ] Drop `installFrameworkPluginsUseCase` (gone Phase 2), `pluginCatalogRepository` (gone Phase 2)

## Tests (unit-first pyramid)

### Unit tests

- [ ] `tests/domain/models/marketplace-source-mode.unit.test.ts` — every factory + invariant
- [ ] `tests/domain/models/setup-flow.unit.test.ts` — every invariant + derived method
- [ ] `tests/application/use-cases/setup/setup-marketplace-source-use-case.unit.test.ts` — interactive vs scripted vs missing-flag-non-interactive
- [ ] `tests/application/use-cases/setup/setup-tools-use-case.unit.test.ts` — empty / AI-only / IDE-only / mixed / failure propagation
- [ ] `tests/application/use-cases/setup/setup-plugins-prompt-use-case.unit.test.ts` — every PluginInstallMode branch
- [ ] `tests/application/use-cases/setup-use-case.unit.test.ts` — orchestration order, error propagation, idempotency on re-run

### Integration tests

- [ ] `tests/application/use-cases/setup-use-case.integration.test.ts` — happy path with in-memory FS port + real `MarketplaceRegistry` adapter pointed at test fixture
- [ ] One scripted-mode flow (`SetupFlow.isScriptable() === true`) producing expected manifest on disk

### E2E tests

- One greenfield setup E2E test in Phase 11 (not here)

## Acceptance criteria

- [ ] `pnpm test tests/application/use-cases/setup` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `aidd setup` (no args, TTY) prompts source / AI / IDE / plugins → succeeds
- [ ] `aidd setup --source remote --all --no-plugins --yes` succeeds without prompts
- [ ] `aidd setup --source local --path /abs/dir --ai claude --ide vscode --no-plugins --yes` succeeds
- [ ] `aidd setup --source local` (no path, non-TTY) errors with clear message
- [ ] Re-running `aidd setup` on installed project: idempotent (no errors, reports up-to-date)
- [ ] No memory stub written to disk after `aidd setup --ai claude`
- [ ] Manifest v5 produced — no `docs/scripts/repo/docsDir/mode/topPlugins`

## Manual validation

```bash
cd /tmp && rm -rf greenfield && mkdir greenfield && cd greenfield

# Interactive
aidd setup
# expect: source prompt → AI checkbox → IDE checkbox → plugins prompt

# Scriptable: full
rm -rf .aidd .claude .vscode .cursor .codex
aidd setup --source remote --all --recommended-plugins --yes

# Scriptable: minimal (build-dist style)
rm -rf .aidd .claude .vscode .cursor .codex
aidd setup --source remote --yes

# Non-TTY missing flags should fail
echo | aidd setup
```

## Risks / breaking changes

- Users scripting `aidd setup --mode local --path X` break. Migration path: document new flags in CHANGELOG. Phase 4 `migrate` does NOT cover this (project-level flag changes, not manifest changes).
- Setup result discriminated union changes — any external consumer of CLI exit metadata must adapt (none expected).

## Commit

```
refactor(setup): rewrite as orchestrator with sub-use-cases

Replace 18KB monolithic SetupUseCase with thin orchestrator chaining:
- SetupMarketplaceSourceUseCase (interactive vs scripted source resolution)
- MarketplaceRegisterFrameworkUseCase (existing)
- MarketplaceRefreshUseCase (existing)
- SetupToolsUseCase (loops InstallRuntimeConfig + InstallIdeConfig)
- SetupPluginsPromptUseCase (delegates to PluginPick or named install)

Introduce SetupFlow aggregate and MarketplaceSourceMode value object.
Drop legacy branches: adopted, installed (legacy fetch), mode-switched.
Drop legacy flags: --from, --switch-mode, --mode, --path, --release.
Add scriptable flags: --source remote|local, --path (with local), --ai/--ide/--all, plugin install mode flags, --yes.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-3.md
```
