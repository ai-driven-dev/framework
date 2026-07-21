# Architecture

## Stack

- TypeScript ESM, Node.js >= 22.12, bundled via tsup → `dist/cli.js`
- Runtime dependencies (6 allowed; each requires explicit justification; new additions require an ADR):
  - `commander` — CLI argument/command parsing
  - `@inquirer/prompts` — interactive terminal prompts
  - `ajv` — JSON-schema validation for marketplace/plugin schemas
  - `ajv-formats` — standard format validators (uri, date, etc.) for ajv
  - `simple-git` — git clone/fetch for plugin distribution
  - `smol-toml` — TOML read/write for Codex config round-trips
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
FrameworkBuildUseCase → BuildOutputStrategy (MarketplaceBuildStrategy | FlatBuildStrategy, reading per-tool ToolBuildContract)
→ tool-native plugin tree (author-side distribution; all 5 targets shipped — claude/cursor/copilot/codex marketplace+flat, opencode flat-only)
```
Author-side, not user-side: translates the Claude-format framework into a tool-native
marketplace dist (Mode A) or flat workspace materialization (Mode B `--flat`).

**Manifest schema migration** (no command — runs on load):
```
Manifest.deserialize → version-to-version migrations in manifest.ts (v1→v2→…→v6)
→ strips obsolete fields; upgraded shape persisted on next manifest write; idempotent on v6
```
The brownfield `aidd migrate` command (backup + strip dead files + rewire plugins) was removed;
older manifests now auto-upgrade when loaded.

## Per-Tool Plugin Install Strategy

Controlled by `PluginsCapability` in each tool definition. How each tool **actually
loads** plugins (verified live against each tool's real CLI/IDE, not inferred):

| Tool | How plugins load | aidd writes |
|---|---|---|
| Claude | `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`) — read natively, no CLI step | the settings file |
| Cursor | materialized to `~/.cursor/plugins/local/<name>/` (user-scope) — auto-discovered as "Local" plugins | the plugin files |
| OpenCode | flat files `.opencode/skills/`, `.opencode/agents/` — auto-discovered | the flat files |
| Codex | **native CLI activation** (`codex plugin add`) into user-global `~/.codex/` + cache | drives the CLI |
| Copilot | **native CLI activation** (`copilot plugin install`) into user-global `~/.copilot/` | drives the CLI + a recommendations file |

- **Some tools' project config is inert — they need native CLI activation.** Codex and
  Copilot do not load plugins from a project file (Codex reads only user-global
  `~/.codex/`; Copilot's `enabledPlugins` only *recommends*). aidd drives their
  `<tool> plugin` subcommands instead. Claude / Cursor / OpenCode do load their project
  artifacts natively. Which tools auto-load vs need activation is a per-tool fact —
  verify it against the real tool, never assume.
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

## Key Design Decisions

- Merge files (JSON/TOML): surgical key-level tracking; uninstall removes only AIDD keys
- IDE-conditional distribution: AI tools declare `requiredIdeIds`; filtered at install time
- IDE tool files (user-prime): never deleted on uninstall
- Error handling: typed exceptions thrown from use-cases/adapters; caught only at command layer
- Manifest schema migration: idempotent version-to-version upgrade applied on load (`manifest.ts`), no manual command

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
