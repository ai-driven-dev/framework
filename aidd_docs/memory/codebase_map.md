# Codebase Map

## Where Things Live

```
src/
├── cli.ts                    # Entry point — commander setup, global flags, preAction hook
├── application/
│   ├── commands/             # CLI wiring only (1 file per command)
│   ├── use-cases/            # Business orchestration
│   │   ├── auth/             # login / logout / status / require-auth
│   │   ├── global/           # global cross-tool ops (status, update, sync, restore, doctor)
│   │   ├── install/          # install + capability sub-use-cases (runtime-config, ide-config, plugins, agents, commands, rules, skills, config)
│   │   ├── marketplace/      # marketplace lifecycle (add/list/remove/refresh/browse/check) + cache
│   │   ├── migrate/          # manifest v3/v4 → v5 migration
│   │   ├── plugin/           # add/remove/list/update + install-from-marketplace + search + sync
│   │   ├── restore/          # restore-use-case + restore-plugin-use-case
│   │   ├── setup/            # setup orchestrator sub-use-cases
│   │   ├── sync/             # sync + sync-status + conflict-resolution
│   │   ├── shared/           # helpers called by use-cases only (never by commands)
│   │   └── *.ts              # top-level use-cases (clean, doctor, init, migrate, setup, status, uninstall...)
│   ├── error-handler.ts      # central error handling
│   ├── errors.ts             # application typed exceptions
│   └── output.ts             # stdout/stderr formatting
├── domain/
│   ├── formats/              # pure string transforms — no I/O (command, json, jsonc, markdown, toml, placeholders)
│   ├── models/               # entities, value objects, discriminant types
│   ├── ports/                # interface contracts (FileSystem, Hasher, Logger, Prompter, etc.)
│   ├── capabilities/         # one capability class per Has* interface (agents, commands, rules, skills, hooks, mcp, memory, settings)
│   └── tools/
│       ├── contracts.ts      # AiTool<C>, Has* interfaces, IdeToolConfig, UserFileSectionKey
│       ├── registry.ts       # ToolConfig union, isAiTool(), registerTool(), getToolConfig(), hasToolSignals()
│       ├── ai/               # one file per AI tool (claude, cursor, copilot, opencode, codex)
│       └── ide/              # one file per IDE tool (vscode)
└── infrastructure/
    ├── adapters/             # port implementations — one adapter per port (incl. auth-reader, auth-storage, http-client)
    ├── assets/               # asset-loader.ts — typed loader for configs/stubs bundled in binary
    ├── deps.ts               # dependency injection wiring
    └── errors.ts             # infrastructure typed exceptions (internal only)
```

## Where to Add Things

| What | Where |
|------|-------|
| New CLI command | `application/commands/` + top-level use-case |
| New use-case | `application/use-cases/<subdir>/` or root for top-level |
| Shared use-case helper | `application/use-cases/shared/` |
| New AI tool | `domain/tools/ai/<toolname>.ts` |
| New capability | `Has*` in `contracts.ts` + class in `domain/capabilities/` |
| New string transform | `domain/formats/` |
| New domain type | `domain/models/` |
| New port | `domain/ports/` + adapter in `infrastructure/adapters/` |

## Tests

```
tests/
├── application/use-cases/    # integration — real filesystem, mock all ports via tests/helpers/ports/
├── domain/models/            # unit — pure value object tests
├── domain/tools/             # unit — tool config tests
├── e2e/                      # full CLI invocation via runCli()
├── infrastructure/           # adapter tests with mock servers/fixtures
└── fixtures/                 # shared test data
```

## Key Files

| File | Purpose |
|------|---------|
| `infrastructure/deps.ts` | Full dependency graph — start here when wiring new deps |
| `infrastructure/assets/asset-loader.ts` | Typed loader for configs/stubs bundled in binary |
| `domain/tools/contracts.ts` | All tool/capability interfaces |
| `domain/tools/registry.ts` | Tool lookup, guards, signal detection |
| `application/use-cases/shared/post-install-pipeline-use-case.ts` | Mandatory post-write sequence |
| `application/use-cases/migrate-use-case.ts` | Brownfield migration — strip obsolete manifest entries |
| `domain/models/manifest.ts` | Aggregate root — all installed file tracking |
