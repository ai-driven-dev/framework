# Codebase Map

## Status

- `src/` — fully implemented through v3.2 + adopt command (all milestones M0-M7 + v3.2 features + adopt done)
- `dist/cli.js` — produced by `pnpm build` (tsup, ESM bundle)
- `tests/` — 528 tests, 46 files, all passing
- Next: vNext interactive mode (not yet specified — do not implement until vision is stabilized)

## Source Layout

```plaintext
src/
├── cli.ts                              # commander program, global --verbose / --repo / --token / --framework / --release
├── application/
│   ├── commands/                       # commander command registrations
│   │   ├── adopt.ts                    # aidd adopt [--force]
│   │   ├── cache.ts                    # aidd cache list / clear
│   │   ├── config.ts                   # aidd config list/get/set (manifest-backed; docsDir + repo writable, tools read-only)
│   │   ├── clean.ts
│   │   ├── doctor.ts                   # includes --fix flag
│   │   ├── init.ts                     # includes --force flag
│   │   ├── install.ts
│   │   ├── restore.ts                  # aidd restore [files] [--tool] [--force]
│   │   ├── status.ts
│   │   ├── sync.ts                     # aidd sync --source <tool> [--target] [--force]
│   │   ├── uninstall.ts
│   │   └── update.ts                   # aidd update [--force] [--dry-run]
│   ├── check-update.ts                 # printUpdateBanner() — shared header banner for all commands
│   ├── output.ts                       # All stdout/stderr formatting
│   └── use-cases/
│       ├── adopt-use-case.ts               # bootstrap manifest from pre-existing AIDD files
│       ├── catalog-use-case.ts              # writeCatalog() — writes aidd_docs/CATALOG.md
│       ├── clean-use-case.ts
│       ├── doctor-use-case.ts
│       ├── gitignore-use-case.ts            # writes .gitignore entry on init
│       ├── init-use-case.ts
│       ├── install-use-case.ts
│       ├── resolve-framework-use-case.ts    # shared: token + framework resolution
│       ├── restore-use-case.ts              # restore modified/deleted files from pinned version
│       ├── status-use-case.ts
│       ├── sync-use-case.ts                 # propagate changes across tools via reverse+forward rewrite
│       ├── uninstall-use-case.ts
│       └── update-use-case.ts              # diff + conflict detection + dry-run
├── domain/
│   ├── models/
│   │   ├── catalog.ts                  # generateCatalogContent() — pure function, no I/O
│   │   ├── distribution.ts             # GeneratedFile[] per tool
│   │   ├── file-hash.ts                # MD5 value object
│   │   ├── framework-descriptor.ts     # framework layout code model (no framework.json file)
│   │   ├── frontmatter.ts              # frontmatter parsing/conversion
│   │   ├── generated-file.ts           # file + hash + merge flag
│   │   ├── manifest.ts                 # aggregate root (persisted at .aidd/manifest.json); fields: docsDir, repo?, tools, docs
│   │   └── tool-config.ts              # per-tool output path / frontmatter rules
│   ├── ports/
│   │   ├── file-system.ts
│   │   ├── framework-loader.ts
│   │   ├── framework-resolver.ts
│   │   ├── hasher.ts
│   │   ├── logger.ts
│   │   ├── manifest-repository.ts
│   │   └── prompter.ts                 # resolveConflict(path, reason: "deleted"|"modified") for restore
│   └── tools/
│       ├── claude.ts
│       ├── copilot.ts
│       └── cursor.ts
└── infrastructure/
    ├── adapters/
    │   ├── file-system-adapter.ts       # mergeJsonFile (strips JSONC comments + deep-merge)
    │   ├── framework-loader-adapter.ts
    │   ├── framework-resolver-adapter.ts
    │   ├── hasher-adapter.ts            # MD5 via node:crypto
    │   ├── logger-adapter.ts
    │   ├── manifest-repository-adapter.ts
    │   └── prompter-adapter.ts          # SilentPrompterAdapter + InquirerPrompterAdapter (TTY guard)
    ├── auth/
    │   └── token-resolver.ts            # --token > AIDD_TOKEN > gh auth token
    ├── cache/
    │   └── framework-cache.ts           # per-version cache in .aidd/cache/
    ├── deps.ts                          # dependency injection wiring
    ├── http/
    │   └── http-client.ts               # node:https, no fetch
    ├── migrations/
    │   └── manifest-migrations.ts       # manifest schema evolution
    └── tar/
        └── tar-extractor.ts             # node:child_process + system tar
```

## Test Layout

```plaintext
tests/
├── application/use-cases/              # unit tests per use-case (vi.fn() mocked ports)
├── domain/models/                      # pure value object tests
├── domain/tools/                       # tool config unit tests
├── e2e/                                # full CLI e2e via child_process + temp dirs
│   ├── adopt.e2e.test.ts
│   ├── init.e2e.test.ts
│   ├── install.e2e.test.ts
│   ├── uninstall.e2e.test.ts
│   ├── status.e2e.test.ts
│   ├── clean.e2e.test.ts
│   ├── doctor.e2e.test.ts
│   ├── update.e2e.test.ts
│   ├── restore.e2e.test.ts
│   ├── sync.e2e.test.ts
│   ├── cache.e2e.test.ts
│   ├── config.e2e.test.ts
│   ├── lifecycle.e2e.test.ts            # full lifecycle including v3.1/v3.2 commands
│   └── global-options.e2e.test.ts
├── fixtures/                           # shared test data (example framework)
├── infrastructure/adapters/            # adapter tests with real temp dirs
├── infrastructure/cache/
└── infrastructure/verbose.test.ts
```

## Non-source Files

- No `settings.json` — all project config is in the manifest (`docsDir`, `repo`) or via flags/env vars
- `package.json` — `@ai-driven-dev/aidd-cli` v3.0.0, GitHub Packages registry, Node >= 24
- `tsup.config.ts` — single ESM bundle, target node20 (build target, runtime requires node >= 24)
- `vitest.config.ts` — test runner with path aliases
- `biome.json` — lint + format config
- `lefthook.yml` — delegates git hooks to parent monorepo
- `commitlint.config.js` — conventional commit validation
- `.github/workflows/ci-commitlint.yml` — CI: commitlint on PR/push to main
- `.aidd/manifest.json` — AIDD framework manifest installed in this repo

## Runtime Dependencies

- `commander` — CLI arg parsing
- `@inquirer/prompts` — interactive prompts (declared, reserved for future interactive commands)
- JSONC comment stripping: local `stripJsoncComments()` in `file-system-adapter.ts`, no external package
