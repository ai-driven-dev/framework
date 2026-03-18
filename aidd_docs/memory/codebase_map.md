# Codebase Map

## Status

- `src/` — fully implemented through v3.2 + adopt + self-update + opencode tool + AIDD branding signals
- `dist/cli.js` — produced by `pnpm build` (tsup, ESM bundle)
- `tests/` — 684 tests, all passing
- Next: vNext interactive mode (not yet specified — do not implement until vision is stabilized)

## Command Output Paths (per tool)

| Tool | Commands path | Frontmatter name |
|------|--------------|-----------------|
| `claude` | `.claude/commands/aidd/<phase>/<name>.md` | `name: aidd:<phase>:<name>` |
| `cursor` | `.cursor/commands/aidd/<phase>/<name>.md` | `name: aidd:<phase>:<name>` |
| `opencode` | `.opencode/commands/aidd/<phase>/<name>.md` | `name: aidd:<phase>:<name>` |
| `copilot` | `.github/prompts/aidd_<phase>_<name>.prompt.md` | `name: aidd:<phase>:<name>` |

- Phase is extracted from leading digits in source dir name (e.g. `02_context` → `02`)
- `buildAiddCommandFilePath(dir, fileName)` in `tool-config.ts` is the shared helper

## Source Layout

```plaintext
src/
├── cli.ts                              # commander program, global --verbose / --repo / --token / --framework / --release
├── application/
│   ├── commands/                       # commander command registrations
│   │   ├── adopt.ts                    # aidd adopt --tools <tools> (--release or --framework required)
│   │   ├── cache.ts                    # aidd cache list / clear
│   │   ├── config.ts                   # aidd config list/get/set
│   │   ├── clean.ts                    # aidd clean [--force]
│   │   ├── doctor.ts                   # aidd doctor
│   │   ├── init.ts                     # aidd init [--force] [--repo]
│   │   ├── install.ts                  # aidd install <tools> [--all] [--force]
│   │   ├── restore.ts                  # aidd restore [files] [--tool] [--docs] [--force]
│   │   ├── status.ts                   # aidd status [--tool] [--docs]
│   │   ├── self-update.ts              # aidd self-update [--check] [--dry-run] [--force]
│   │   ├── sync.ts                     # aidd sync --source <tool> [--target] [--force]
│   │   ├── uninstall.ts                # aidd uninstall <tools> [--all]
│   │   └── update.ts                   # aidd update [--force] [--dry-run] [--tool] [--docs]
│   ├── check-update.ts                 # printUpdateBanner() — called via commander preAction hook in cli.ts
│   ├── output.ts                       # All stdout/stderr formatting
│   └── use-cases/
│       ├── adopt-use-case.ts               # registers framework files from disk; user files ignored
│       ├── catalog-use-case.ts             # generates CATALOG.md
│       ├── clean-use-case.ts
│       ├── doctor-use-case.ts
│       ├── gitignore-use-case.ts
│       ├── init-use-case.ts
│       ├── install-use-case.ts
│       ├── resolve-framework-use-case.ts   # shared: framework resolution (remote/local)
│       ├── restore-use-case.ts
│       ├── status-use-case.ts
│       ├── sync-use-case.ts
│       ├── uninstall-use-case.ts
│       └── update-use-case.ts
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
│       ├── cursor.ts
│       └── opencode.ts
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
├── domain/tools/                       # tool config unit tests (claude, copilot, cursor, opencode)
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
│   ├── self-update.e2e.test.ts
│   ├── lifecycle.e2e.test.ts            # full lifecycle including v3.1/v3.2 commands
│   └── global-options.e2e.test.ts
├── fixtures/                           # shared test data (example framework)
├── infrastructure/adapters/            # adapter tests with real temp dirs
├── infrastructure/cache/
└── infrastructure/verbose.test.ts
```

## Non-source Files

- No `settings.json` — all project config is in the manifest (`docsDir`, `repo`) or via flags/env vars
- `package.json` — `@ai-driven-dev/cli` v2.7.3, GitHub Packages registry, Node >= 24
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
