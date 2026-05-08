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

## Install Flows (high-level)

**AI tool runtime config** (`aidd install ai <tool>`):
```
InstallRuntimeConfigUseCase → AssetLoader (bundled in binary) → FileSystem + ManifestRepository
```

**IDE config** (`aidd install ide <tool>`):
```
InstallIdeConfigUseCase → AssetLoader (bundled in binary) → FileSystem + ManifestRepository
```

**Plugin** (`aidd plugin install <name>`):
```
PluginInstallFromMarketplaceUseCase → MarketplaceRegistry + PluginFetcher (git clone)
→ Distribution (per-tool rewrite) → FileSystem → PostInstallPipeline
```

**Migration** (`aidd migrate`):
```
MigrateUseCase → ManifestRepository (detect obsolete scripts/plugins sections + bundled plugins)
→ backup + strip entries + best-effort rewire via marketplace
```

## Auth

Token resolution: `AIDD_TOKEN` env → project `.aidd/auth.json` → user `~/.config/aidd/auth.json` → `gh auth token` (only when `method: "gh"`) → none

## Bundled Assets

Runtime configs and IDE configs ship inside the CLI binary (tsup bundles them):
- `src/infrastructure/assets/asset-loader.ts` — typed loader, esbuild text/json loaders at build time
- `.md` files → text loader (string); `.json` → native import (object); `.toml` → text loader (string)
- No fs reads at runtime — all assets inlined at bundle time

## Key Design Decisions

- Merge files (JSON/TOML): surgical key-level tracking; uninstall removes only AIDD keys
- IDE-conditional distribution: AI tools declare `requiredIdeIds`; filtered at install time
- IDE tool files (user-prime): never deleted on uninstall
- Error handling: typed exceptions thrown from use-cases/adapters; caught only at command layer
- `aidd migrate`: idempotent, `--dry-run` safe, backup before writes, best-effort plugin rewire via marketplace

## Foreign-Format Adapters (Phase A — Cursor only)

Future capability: ingest native marketplace formats from other AI tools.
Pipeline: `NativeFormat → Parser → NormalizedPlugin → Emitter[targetTool] → ToolNativeFiles`

**Phase A (Cursor) — shipped:**
- `src/domain/models/normalized-plugin.ts` — `NormalizedPlugin` internal AST (NOT versioned); `ForeignMarketplaceSource` union
- `src/domain/formats/cursor-marketplace.ts` — pure parser `parseCursorMarketplace(rawJson)` → `NormalizedCatalog`
- `ForeignSchemaValidationError` in `src/domain/errors.ts` — thrown on invalid foreign schema
- Cursor's `marketplace.json` schema mirrors Claude's catalog shape (official schema undocumented as of 2026-05-06)
- Integration with fetcher pipeline deferred to Phase A.5

**Phases B (Copilot), C (Codex) — deferred. Phase D (OpenCode) — emitter complete (Part 3); marketplace adapter deferred.**
