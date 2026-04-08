# Codebase Map

## Status

- `src/` — fully implemented through v2.10.0 + adopt + self-update + opencode tool + AIDD branding signals + doctor signal detection + application layer refactoring (Phase 1–4)
- `dist/cli.js` — produced by `pnpm build` (tsup, ESM bundle)
- `tests/` — 932 tests, all passing
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
- `ToolConfig.signalDir` — directory to scan for aidd frontmatter per tool (used by `hasToolSignals()`)
- `hasToolSignals(fs, config, projectRoot)` in `tool-config.ts` — shared signal detection for init and doctor

## Source Layout

```plaintext
src/
├── cli.ts                              # commander program, global --verbose / --repo
├── application/
│   ├── commands/                       # commander command registrations
│   │   ├── auth.ts                     # aidd auth login/logout/status
│   │   ├── cache.ts                    # aidd cache list / clear
│   │   ├── config.ts                   # aidd config list/get/set
│   │   ├── clean.ts                    # aidd clean [--force]
│   │   ├── doctor.ts                   # aidd doctor
│   │   ├── install.ts                  # aidd install <tools> [--all] [--force]
│   │   ├── restore.ts                  # aidd restore [files] [--tool] [--docs] [--force]
│   │   ├── status.ts                   # aidd status [--tool] [--docs]
│   │   ├── self-update.ts              # aidd self-update [--check] [--dry-run] [--force]
│   │   ├── setup.ts                    # aidd setup (interactive onboarding entry point)
│   │   ├── sync.ts                     # aidd sync --source <tool> [--target] [--force]
│   │   ├── uninstall.ts                # aidd uninstall <tools> [--all]
│   │   └── update.ts                   # aidd update [--force] [--dry-run] [--tool] [--docs]
│   ├── check-update.ts                 # printUpdateBanner() — called via commander preAction hook in cli.ts
│   ├── error-handler.ts                # ErrorHandler — central error handling for commands (replaces output.exit)
│   ├── errors.ts                       # Application typed exceptions (NoManifestError, InputRequiredError, etc.)
│   ├── output.ts                       # All stdout/stderr formatting (pure output, no exit logic)
│   └── use-cases/
│       ├── auth-login-use-case.ts          # store PAT or gh CLI config; validates token via GitHub API
│       ├── auth-logout-use-case.ts         # remove stored credential
│       ├── auth-status-use-case.ts         # check current auth and validate token
│       ├── adopt-use-case.ts               # registers framework files from disk; user files ignored
│       ├── catalog-use-case.ts             # generates CATALOG.md
│       ├── clean-use-case.ts
│       ├── doctor-use-case.ts
│       ├── gitignore-use-case.ts
│       ├── init-use-case.ts
│       ├── install-use-case.ts
│       ├── memory-script-use-case.ts       # writes/updates memory bank script for all installed tools
│       ├── resolve-framework-use-case.ts   # framework resolution (remote/local)
│       ├── restore-use-case.ts
│       ├── self-update-use-case.ts         # update CLI binary to latest release
│       ├── setup-use-case.ts               # interactive onboarding entry point
│       ├── status-use-case.ts
│       ├── sync-use-case.ts
│       ├── uninstall-use-case.ts
│       ├── update-use-case.ts
│       └── shared/
│           ├── post-install-pipeline-use-case.ts  # canonical post-write sequence: MemoryScript → save → Catalog → Gitignore
│           └── setup-state-detector.ts            # detect project setup phase (needs-init/adopt/install/update/up-to-date)
├── domain/
│   ├── models/
│   │   ├── catalog.ts                  # generateCatalogContent() — pure function, no I/O
│   │   ├── conflict-decision.ts        # ConflictDecision = "overwrite" | "skip" | "backup"
│   │   ├── distribution.ts             # GeneratedFile[] per tool
│   │   ├── docs.ts                     # documentation distribution: path remapping, content rewriting
│   │   ├── file-diff.ts                # FileDiffKind, FileDiff — discriminant type for update diffs
│   │   ├── file-hash.ts                # MD5 value object
│   │   ├── framework-descriptor.ts     # framework layout code model (no framework.json file)
│   │   ├── frontmatter.ts              # frontmatter parsing/conversion
│   │   ├── generated-file.ts           # file + hash + merge flag
│   │   ├── manifest.ts                 # aggregate root (persisted at .aidd/manifest.json); fields: docsDir, repo?, tools, docs
│   │   ├── mcp.ts                      # MCP config transformation for Windows command path fixes
│   │   ├── semver.ts                   # semantic version parsing & comparison for update checks
│   │   ├── sync-exclusions.ts          # SYNC_EXCLUDED_FILES, isSyncExcluded — sync skip list
│   │   ├── tool-config.ts              # per-tool output path / frontmatter rules
│   │   └── update-scope.ts             # UpdateScope, parseUpdateScope, formatToolScopeValue
│   ├── models/
│   │   └── auth-config.ts              # AuthConfig { version, method, level, token?, createdAt }
│   ├── ports/
│   │   ├── auth-token-provider.ts      # resolve(): Promise<string | null> — implemented by AuthReader
│   │   ├── external-token-provider.ts  # resolve(): string | null — implemented by GhCliAdapter
│   │   ├── cli-updater.ts              # fetchLatestRelease(), install() — used by self-update
│   │   ├── current-version-provider.ts # get() returns current CLI version string
│   │   ├── file-system.ts
│   │   ├── framework-loader.ts
│   │   ├── framework-resolver.ts
│   │   ├── hasher.ts
│   │   ├── logger.ts
│   │   ├── manifest-repository.ts
│   │   ├── platform.ts                 # current() returns platform identifier for MCP transforms
│   │   └── prompter.ts                 # resolveConflict(path, reason: "deleted"|"modified") for restore
│   └── tools/
│       ├── claude.ts
│       ├── copilot.ts
│       ├── cursor.ts
│       └── opencode.ts
└── infrastructure/
    ├── adapters/
    │   ├── gh-cli-adapter.ts            # ExternalTokenProvider — calls `gh auth token` (3s timeout)
    │   ├── cli-updater-adapter.ts       # GitHub CLI Release API for self-update
    │   ├── current-version-adapter.ts   # reads package.json version at runtime
    │   ├── file-system-adapter.ts       # mergeJsonFile (strips JSONC comments + deep-merge)
    │   ├── framework-loader-adapter.ts
    │   ├── framework-resolver-adapter.ts
    │   ├── hasher-adapter.ts            # MD5 via node:crypto
    │   ├── logger-adapter.ts
    │   ├── manifest-repository-adapter.ts
    │   ├── platform-adapter.ts          # node:os wrapper for platform detection
    │   └── prompter-adapter.ts          # SilentPrompterAdapter + InquirerPrompterAdapter (TTY guard)
    ├── auth/
    │   ├── auth-reader.ts               # AuthTokenProvider impl — AIDD_TOKEN > project > user > gh (only if method=gh)
    │   └── auth-storage.ts              # read/write ~/.config/aidd/auth.json or .aidd/auth.json (chmod 600)
    ├── cache/
    │   └── framework-cache.ts           # per-version cache in .aidd/cache/
    ├── deps.ts                          # dependency injection wiring
    ├── errors.ts                        # Infrastructure typed exceptions (HttpError, GhCliError, etc. — internal only)
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
- `package.json` — `@ai-driven-dev/cli` v2.10.0, GitHub Packages registry, Node >= 24
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
