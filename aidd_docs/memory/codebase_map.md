# Codebase Map

## Where Things Live

```
src/
├── cli.ts                    # Entry point — commander setup, global flags, preAction hook
├── application/
│   ├── commands/             # CLI wiring only (1 file per command)
│   ├── use-cases/            # Business orchestration
│   │   ├── adopt/            # adopt-use-case + sub-use-cases
│   │   ├── auth/             # login / logout / status / require-auth
│   │   ├── install/          # install + 6 capability sub-use-cases
│   │   ├── restore/          # orchestrator only
│   │   ├── sync/             # sync + sync-status + conflict-resolution
│   │   ├── update/           # update + 6 capability sub-use-cases
│   │   ├── shared/           # helpers called by use-cases only (never by commands)
│   │   └── *.ts              # top-level use-cases (clean, doctor, init, setup, status, uninstall...)
│   ├── check-update.ts       # update banner
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
    ├── adapters/             # port implementations — one adapter per port
    ├── auth/                 # token reading and storage
    ├── cache/                # framework version caching
    ├── deps.ts               # dependency injection wiring
    ├── errors.ts             # infrastructure typed exceptions (internal only)
    ├── http/                 # node:https client
    ├── migrations/           # manifest schema evolution
    └── tar/                  # tarball extraction
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
├── application/use-cases/    # integration — real filesystem, mock Prompter + FrameworkResolver only
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
| `domain/tools/contracts.ts` | All tool/capability interfaces |
| `domain/tools/registry.ts` | Tool lookup, guards, signal detection |
| `application/use-cases/shared/post-install-pipeline-use-case.ts` | Mandatory post-write sequence |
| `domain/models/manifest.ts` | Aggregate root — all installed file tracking |
