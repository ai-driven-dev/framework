# Architecture

## Stack

- TypeScript ESM, Node.js >= 24, bundled via tsup → `dist/cli.js`
- 2 runtime deps max: `commander` (CLI), `@inquirer/prompts` (interactive); rest = Node.js built-ins
- Vitest (tests), Biome (lint/format), Lefthook (git hooks via parent monorepo)

## Layers

3-layer hexagonal architecture — dependencies flow inward only:

```
Infrastructure → Application → Domain
```

| Layer | Path | Role |
|---|---|---|
| Domain | `src/domain/` | Models, ports, formats, capabilities, tool definitions |
| Application | `src/application/` | Use-cases, commands (CLI wiring only) |
| Infrastructure | `src/infrastructure/` | Adapters (filesystem, HTTP, GitHub, auth, cache) |

## Key Domain Concepts

- `AiTool<C>` — generic AI tool type; `C` = intersection of `Has*` capability interfaces
- `IdeToolConfig` — IDE tool type (vscode); no capabilities
- `ToolConfig = AiTool<unknown> | IdeToolConfig` — discriminated union; `isAiTool()` is the guard
- `Manifest` — aggregate root, tracks every installed file with MD5 hash (`.aidd/manifest.json`)
- Framework layout is code-defined — no `framework.json` on disk

## Domain Models (notable)

| Model | File | Description |
|---|---|---|
| `MarketplaceSourceMode` | `domain/models/marketplace-source-mode.ts` | Marketplace source type with optional `ref` |
| `SetupFlow` | `domain/models/setup-flow.ts` | Aggregate: setup orchestration state |
| `MigrationPlan` | `domain/models/migration-plan.ts` | Value object: brownfield migration decisions |
| `MarketplaceEntry` | `domain/capabilities/marketplace-entry.ts` | Per-tool marketplace registration entry |
| `MarketplaceCacheEntry` | `domain/models/marketplace-cache-entry.ts` | Cached catalog TTL entry |
| `NormalizedPlugin` | `domain/models/normalized-plugin.ts` | Foreign-format AST (internal; non-versioned) |
| `LatestReleaseResolver` | `domain/ports/latest-release-resolver.ts` | Port: resolve latest GitHub release tag |

## Install Flows (high-level)

**AI tool runtime config** (`aidd ai install <tool>`):
```
InstallRuntimeConfigUseCase → AssetLoader (bundled in binary) → FileSystem + ManifestRepository
```

**IDE config** (`aidd ide install <tool>`):
```
InstallIdeConfigUseCase → AssetLoader (bundled in binary) → FileSystem + ManifestRepository
```

**Plugin** (`aidd plugin install <name>`):
```
PluginInstallFromMarketplaceUseCase → MarketplaceRegistry + PluginFetcher (git clone)
→ Distribution (per-tool rewrite) → FileSystem → PostInstallPipeline
```

**Framework build** (`aidd framework build --target <tool>`):
```
FrameworkBuildUseCase → BuildOutputStrategy (Marketplace | Flat | Codex)
→ tool-native plugin tree (author-side distribution; copilot + codex shipped, cursor/opencode pending)
```
Author-side, not user-side: translates the Claude-format framework into a tool-native
marketplace dist (Mode A) or flat workspace materialization (Mode B `--flat`).

**Migration** (`aidd migrate`):
```
MigrateUseCase → ManifestRepository (detect obsolete scripts/plugins sections + bundled plugins)
→ backup + strip entries + best-effort rewire via marketplace
```

## Per-Tool Plugin Install Strategy

Controlled by `PluginsCapability` mode field in each tool definition:

| Tool | Mode | Settings path (marketplace registration) | Config output path |
|---|---|---|---|
| Claude | `native` | `.claude/settings.json` | `.claude/settings.json` |
| Cursor | `native` | `.cursor/settings.json` | `.cursor/settings.json` |
| Copilot | `native` | `.github/copilot/settings.json` | `.vscode/settings.json` |
| Codex | `native` | `.codex/config.json` | `.codex/config.toml` |
| OpenCode | `flat` | — (no marketplace support) | `opencode.json` |

- `native` mode: plugins registered via `marketplaceSettings` in tool's settings JSON; files materialized under tool-specific `pluginsDir`
- `flat` mode: plugins installed as flat files under a namespace prefix; no native marketplace concept (OpenCode only)

## Auth

Token resolution: `AIDD_TOKEN` env → project `.aidd/auth.json` → user `~/.config/aidd/auth.json` → `gh auth token` (only when `method: "gh"`) → none

## Bundled Assets

Runtime configs and IDE configs ship inside the CLI binary (tsup bundles them):
- `src/infrastructure/assets/asset-loader.ts` — typed loader, esbuild text/json loaders at build time
- `.md` files → text loader (string); `.json` → native import (object); `.toml` → text loader (string)
- No fs reads at runtime — all assets inlined at bundle time

## Bundle Budget

- Budget: 500 KB (`bundleBudgetKB` in `package.json`)
- Enforced at build time: `scripts/check-bundle-size.mjs` runs after `tsup`
- Perf regression tracker: `scripts/check-perf-regression.mjs` + `scripts/perf-baseline.json` (4 commands: `--version`, `--help`, `status`, `ai list`)

## Key Design Decisions

- Merge files (JSON/TOML): surgical key-level tracking; uninstall removes only AIDD keys
- IDE-conditional distribution: AI tools declare `requiredIdeIds`; filtered at install time
- IDE tool files (user-prime): never deleted on uninstall
- Error handling: typed exceptions thrown from use-cases/adapters; caught only at command layer
- `aidd migrate`: idempotent, `--dry-run` safe, backup before writes, best-effort plugin rewire via marketplace

## Foreign-Format Adapters (COMPLETE)

Ingests native marketplace/config formats from other AI tools.
Pipeline: `NativeFormat → Parser → NormalizedPlugin → Emitter[targetTool] → ToolNativeFiles`

| Tool | File | Notes |
|---|---|---|
| Cursor | `src/domain/formats/cursor-marketplace.ts` | `parseCursorMarketplace(rawJson)` → `NormalizedCatalog` |
| Copilot | `src/domain/formats/copilot-marketplace.ts` | Single-entry degenerate catalog from `.github/plugin/plugin.json` |
| Codex | `src/domain/formats/codex-marketplace.ts` | Multi-entry catalog at `.agents/plugins/marketplace.json` |
| OpenCode | `src/domain/formats/opencode-marketplace.ts` | npm specifier strings from `opencode.json`; empty catalog when `plugin` field absent |

**ForeignMarketplaceSource union:** `"cursor" | "copilot" | "codex" | "opencode"`

**MARKETPLACE_PROBES:** cursor `.cursor-plugin/marketplace.json`, copilot `.github/plugin/plugin.json`, codex `.agents/plugins/marketplace.json`, opencode `opencode.json`

**Error type:** `ForeignSchemaValidationError` in `src/domain/errors.ts` — thrown on invalid foreign schema
