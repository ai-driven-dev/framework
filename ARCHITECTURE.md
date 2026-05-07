# Architecture

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  CLI Entry (src/cli.ts)                                     │
│  Command registration only — no business logic              │
├─────────────────────────────────────────────────────────────┤
│  Commands (src/application/commands/)                       │
│  Thin wiring: parse flags → call use-case → display result  │
├─────────────────────────────────────────────────────────────┤
│  Use Cases (src/application/use-cases/)                     │
│  Orchestration: auth/ global/ install/ marketplace/ migrate/ plugin/ restore/ setup/ shared/ sync/       │
│  SetupUseCase (orchestrator), MigrateUseCase, SyncUseCase   │
├─────────────────────────────────────────────────────────────┤
│  Domain (src/domain/)                                       │
│  models/   — entities, value objects, pure functions        │
│  ports/    — interface contracts (no implementations)       │
│  formats/  — pure string transforms (TOML, Markdown, JSON)  │
│  capabilities/ — agents, commands, hooks, mcp, rules, skills│
│  tools/    — AI + IDE tool definitions and registry         │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure (src/infrastructure/)                       │
│  adapters/ — port implementations, all I/O                  │
│  assets/   — bundled runtime configs (embedded in binary)   │
│  auth/     — credential storage and resolution              │
│  git/      — token injection for authenticated git fetches  │
│  http/     — HTTP client                                    │
└─────────────────────────────────────────────────────────────┘
```

Dependencies point inward only: infrastructure → application → domain. Domain never imports from application or infrastructure.

## Key Domain Models (v5)

| Model | Description |
|---|---|
| `SetupFlow` | Aggregate carrying all setup parameters (source, tools, pluginMode, interactive) |
| `MarketplaceSourceMode` | Value object: `remote()` or `local(path)` |
| `MigrationPlan` | Plan for upgrading a manifest — strips obsolete entries, records what changed |
| `MarketplaceEntry` | A registered marketplace (name, source, trustLevel) |
| `MarketplaceCacheEntry` | Cached catalog fetch (marketplace name, fetchedAt, size) |
| `Manifest` (v5) | Schema: `version`, `tools`, `plugins` (per-tool), `marketplaces`. Removed: `docsDir`, `repo`, `mode`, `scripts`, `topPlugins` |
| `Plugin` | Installed plugin: id, source (marketplace + version), tool, files |
| `PluginDistribution` | Capability files for a plugin as fetched from the source |

## Command Surface (noun-first)

```
aidd setup          — orchestrator: init + marketplace + tools + plugins
aidd ai             — AI tool management (install/uninstall/list/status/update/sync/restore/doctor)
aidd ide            — IDE tool management (install/uninstall/list/status/update/doctor)
aidd plugin         — plugin management (add/remove/list/install/search/pick/update)
aidd marketplace    — marketplace management (add/list/remove/refresh/browse/check/cache)
aidd migrate        — manifest v3→v5 migration
aidd status         — global drift view (delegates to ai + ide status)
aidd doctor         — global integrity check (delegates to ai + ide doctor)
aidd restore        — global file restore (delegates to ai restore)
aidd sync           — global sync (delegates to ai sync)
aidd update         — global update (delegates to ai + ide update)
aidd clean          — remove all AIDD files
aidd auth           — credential management
aidd self-update    — update the CLI binary
```

Legacy commands removed in v5: `aidd cache`, `aidd config`, `aidd install` (top-level), `aidd uninstall` (top-level).

## Plugin Architecture

Plugins are distributed via marketplace catalogs (Git repos with `marketplace.json` + `plugins/`). Each plugin provides capability files (agents, commands, hooks, mcp, rules, skills) per AI tool format. The CLI translates plugin distributions between tool formats using reverse + forward content rewriting (plugin sync pipeline).

Memory ownership (CLAUDE.md, AGENTS.md, copilot-instructions.md) is delegated to the `aidd-context` plugin — not bundled in the CLI binary.

## Dependency Wiring

- `createDeps(projectRoot, globalOptions, output)` — full dep graph, memoized per project root
- `createMenuDeps()` — pre-parse only (ManifestRepository + Prompter)
- `deps.ts` assembles the entire adapter graph; commands never instantiate adapters directly

## Testing

- `*.unit.test.ts` — domain models, pure functions; no I/O
- `*.integration.test.ts` — use-cases and adapters with real temp filesystem
- `*.e2e.test.ts` — full CLI binary invocation via `runCli()`, temp dir per test
