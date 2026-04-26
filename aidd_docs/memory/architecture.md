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

## Install Flow (high-level)

```
CLI Command → UseCase → FrameworkResolver (download/cache) → FrameworkLoader (layout)
→ Distribution (per-tool rewrite) → FileSystem (write) → PostInstallPipeline (memory/manifest/catalog/gitignore)
```

## Auth

Token resolution: `AIDD_TOKEN` env → project `.aidd/auth.json` → user `~/.config/aidd/auth.json` → `gh auth token` (only when `method: "gh"`) → none

## Key Design Decisions

- Merge files (JSON/TOML): surgical key-level tracking; uninstall removes only AIDD keys
- IDE-conditional distribution: AI tools declare `requiredIdeIds`; filtered at install time
- IDE tool files (user-prime): never deleted on uninstall
- Error handling: typed exceptions thrown from use-cases/adapters; caught only at command layer
