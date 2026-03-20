# 2026-03 Comprehensive Test Pass

Date: 2026-03-20
Branch: feat/interactive-mode-squashed
Tests at start: 751 passed (57 test files)

## Command Inventory

### `aidd setup` (setup.ts)
Flags: `--path`, `--release`
Note: TTY-only command. All state branches tested in SetupUseCase unit tests.

| Scenario | Covered | File |
|---|---|---|
| Non-TTY guard exits 1 | YES | setup.e2e.test.ts |
| --help shows options | YES | setup.e2e.test.ts |

### `aidd init` (init.ts) — hidden from public help
Flags: `--docs-dir`, `--force`, `--path`, `--release`

| Scenario | Covered | File |
|---|---|---|
| Happy path creates docs dir + manifest | YES | init.e2e.test.ts |
| --docs-dir custom name | YES | init.e2e.test.ts |
| --docs-dir invalid characters | YES | init.e2e.test.ts |
| Error when aidd_docs exists without manifest | YES | init.e2e.test.ts |
| Error when .claude/ with aidd frontmatter exists without manifest | YES | init.e2e.test.ts |
| Error when .opencode/ with aidd frontmatter exists without manifest | YES | init.e2e.test.ts |
| Error when AGENTS.md exists without manifest | YES | init.e2e.test.ts |
| Succeeds when only .aidd/cache/ exists | YES | init.e2e.test.ts |
| Error when already initialized without --force | YES | init.e2e.test.ts |
| Re-copies docs with --force | YES | init.e2e.test.ts |
| Error when --force without prior init | YES | init.e2e.test.ts |
| --repo with --path warns remote source ignored | YES | init.e2e.test.ts |
| --repo saves to manifest | MISSING | — |

### `aidd adopt` (adopt.ts) — hidden from public help
Flags: `--tools`, `--docs-dir`, `--from`

| Scenario | Covered | File |
|---|---|---|
| --help shows flags | YES | adopt.e2e.test.ts |
| Error when --from not provided | YES | adopt.e2e.test.ts |
| Error when --tools missing in non-TTY | YES | adopt.e2e.test.ts |
| Error with unknown tool name | YES | adopt.e2e.test.ts |
| Error when tool directory does not exist | YES | adopt.e2e.test.ts |
| Error when manifest already exists | YES | adopt.e2e.test.ts |
| Happy path: creates manifest from .claude/ files | YES | adopt.e2e.test.ts |
| Status shows no drift after adopt | YES | adopt.e2e.test.ts |
| Adopts claude + cursor | YES | adopt.e2e.test.ts |
| Adopts claude + cursor + copilot | YES | adopt.e2e.test.ts |
| Deletes legacy config.json | YES | adopt.e2e.test.ts |
| Does not register user files not in distribution | YES | adopt.e2e.test.ts |
| --repo propagates to AdoptRequiresVersionError | YES | adopt.e2e.test.ts |

### `aidd install` (install.ts)
Flags: `--force/-f`, `--all/-a`, `--path`, `--release`
Tools: claude, cursor, copilot, opencode

| Scenario | Covered | File |
|---|---|---|
| Error without manifest (no init first) | YES | install.e2e.test.ts |
| Install claude | YES | install.e2e.test.ts |
| Install cursor | YES | install.e2e.test.ts |
| Install copilot | YES | install.e2e.test.ts |
| Install opencode | MISSING | — |
| Error on unknown tool ID | YES | install.e2e.test.ts |
| Skip already installed without --force | YES | install.e2e.test.ts |
| Reinstall with --force | YES | install.e2e.test.ts |
| Install all with --all | YES | install.e2e.test.ts |
| Error in non-TTY without tool and without --all | YES | install.e2e.test.ts |
| No drift after install all | YES | install.e2e.test.ts |
| Reinstall all with --all --force | YES | install.e2e.test.ts |
| Custom docs-dir from manifest | YES | install.e2e.test.ts |
| Path placeholders resolved in files | YES | install.e2e.test.ts |
| Memory update script installed | YES | install.e2e.test.ts |
| Git pre-commit hook installed | YES | install.e2e.test.ts |
| Appends to existing hook without replacing | YES | install.e2e.test.ts |
| Idempotent hook append | YES | install.e2e.test.ts |
| --all with explicit tools warns and ignores tools | MISSING | — |

### `aidd uninstall` (uninstall.ts)
Flags: `--all/-a`

| Scenario | Covered | File |
|---|---|---|
| Removes tool without touching others | YES | uninstall.e2e.test.ts |
| Error when tool not installed | YES | uninstall.e2e.test.ts |
| Error without manifest | YES | uninstall.e2e.test.ts |
| Remove multiple tools | YES | uninstall.e2e.test.ts |
| Error on unknown tool ID | YES | uninstall.e2e.test.ts |
| Error in non-TTY without tool and without --all | YES | uninstall.e2e.test.ts |
| Uninstall all with --all | YES | uninstall.e2e.test.ts |
| Manifest reflects remaining tools after partial uninstall | YES | uninstall.e2e.test.ts |
| --all with explicit tools warns and ignores | YES | uninstall.e2e.test.ts |
| --all reports success when no tools installed | MISSING | — |

### `aidd status` (status.ts)
Flags: `--tool`, `--docs`

| Scenario | Covered | File |
|---|---|---|
| All in sync after install | YES | status.e2e.test.ts |
| Modified file as drifted | YES | status.e2e.test.ts |
| Deleted file as missing | YES | status.e2e.test.ts |
| --tool filter | YES | status.e2e.test.ts |
| Untracked file as added | YES | status.e2e.test.ts |
| Error on unknown --tool | YES | status.e2e.test.ts |
| Error when --tool specifies uninstalled tool | YES | status.e2e.test.ts |
| Error without manifest | YES | status.e2e.test.ts |
| --repo in NoManifestError | YES | status.e2e.test.ts |
| Docs drift with no tools installed | YES | status.e2e.test.ts |
| --docs filter | MISSING | — |
| --tool and --docs mutually exclusive | MISSING | — |

### `aidd update` (update.ts)
Flags: `--force/-f`, `--dry-run`, `--tool`, `--docs`, `--path`, `--release`

| Scenario | Covered | File |
|---|---|---|
| Error without manifest | YES | update.e2e.test.ts |
| Already up to date | YES | update.e2e.test.ts |
| Apply added + changed files in newer version | YES | update.e2e.test.ts |
| Removes files not in newer version | YES | update.e2e.test.ts |
| Creates .backup on user-modified file | YES | update.e2e.test.ts |
| --dry-run shows what would change | YES | update.e2e.test.ts |
| --force overwrites conflicts | YES | update.e2e.test.ts |
| Updates docs files | YES | update.e2e.test.ts |
| --help shows options | YES | update.e2e.test.ts |
| Updates memory script | YES | update.e2e.test.ts |
| --tool scope limits update to specific tool | MISSING | — |
| --docs scope limits update to docs only | MISSING | — |
| --tool and --docs mutually exclusive | MISSING | — |

### `aidd restore` (restore.ts)
Flags: `--force/-f`, `--tool`, `--docs`, `--path`, `--release`
Arguments: `[files...]`

| Scenario | Covered | File |
|---|---|---|
| Error without manifest | YES | restore.e2e.test.ts |
| Nothing to restore | YES | restore.e2e.test.ts |
| Restore modified file with --force | YES | restore.e2e.test.ts |
| Recreate deleted file with --force | YES | restore.e2e.test.ts |
| Restore specific file by path | YES | restore.e2e.test.ts |
| --tool scope | YES | restore.e2e.test.ts |
| Restore by directory prefix | YES | restore.e2e.test.ts |
| Preserves untracked files | YES | restore.e2e.test.ts |
| Error without --force in non-TTY | YES | restore.e2e.test.ts |
| Restore deleted docs file | YES | restore.e2e.test.ts |
| Restore modified docs file | YES | restore.e2e.test.ts |
| --help shows options | YES | restore.e2e.test.ts |
| --docs scope limits restore to docs only | MISSING | — |
| --tool and --docs mutually exclusive | MISSING | — |

### `aidd sync` (sync.ts)
Flags: `--source`, `--target`, `--force/-f`, `--include-user-files`

| Scenario | Covered | File |
|---|---|---|
| Error on unknown --source | YES | sync.e2e.test.ts |
| Error on unknown --target | YES | sync.e2e.test.ts |
| Error without manifest | YES | sync.e2e.test.ts |
| Error when source not installed | YES | sync.e2e.test.ts |
| Error with only 1 tool installed | YES | sync.e2e.test.ts |
| Error when source == target | YES | sync.e2e.test.ts |
| Nothing to sync | YES | sync.e2e.test.ts |
| Sync modified rule claude -> cursor | YES | sync.e2e.test.ts |
| Propagate deletion | YES | sync.e2e.test.ts |
| Broadcast sync to all tools | YES | sync.e2e.test.ts |
| Error when specified target not installed | YES | sync.e2e.test.ts |
| Force sync without blocking on conflict | YES | sync.e2e.test.ts |
| --help shows options | YES | sync.e2e.test.ts |
| --include-user-files syncs user agents | YES | sync.e2e.test.ts |
| Sync claude -> copilot | YES | sync.e2e.test.ts |
| Error when --source missing in non-TTY | YES (implicit: requires --source) | sync.e2e.test.ts |

### `aidd doctor` (doctor.ts)
No flags.

| Scenario | Covered | File |
|---|---|---|
| Healthy installation | YES | doctor.e2e.test.ts |
| Corrupted manifest JSON | YES | doctor.e2e.test.ts |
| No manifest | YES | doctor.e2e.test.ts |
| Broken @path reference | YES | doctor.e2e.test.ts |
| Docs directory missing from disk | YES | doctor.e2e.test.ts |
| Orphaned directories warning | YES | doctor.e2e.test.ts |

### `aidd clean` (clean.ts)
Flags: `--force`

| Scenario | Covered | File |
|---|---|---|
| Dry-run preview without --force (TTY) | YES | clean.e2e.test.ts |
| Delete all files with --force | YES | clean.e2e.test.ts |
| Nothing to clean | YES | clean.e2e.test.ts |
| Dry-run shows tool names and file counts | YES | clean.e2e.test.ts |
| Multiple tools cleaned with --force | YES | clean.e2e.test.ts |
| Only init run: docs + manifest removed | YES | clean.e2e.test.ts |
| Non-TTY dry-run shows "Would remove" + --force hint | MISSING | — |

### `aidd cache list/clear` (cache.ts)
Flags: `--all/-a`

| Scenario | Covered | File |
|---|---|---|
| List: no cached versions | YES | cache.e2e.test.ts |
| List: after install | YES | cache.e2e.test.ts |
| Clear: --all on empty cache | YES | cache.e2e.test.ts |
| Clear: non-TTY without version/--all exits 1 | YES | cache.e2e.test.ts |
| Clear: unknown version exits 1 | YES | cache.e2e.test.ts |
| Clear: --all | YES | cache.e2e.test.ts |
| Clear: --all with version argument exits 1 | YES | cache.e2e.test.ts |

### `aidd config list/get/set` (config.ts)
Flags for set: `--force/-f`

| Scenario | Covered | File |
|---|---|---|
| list: no manifest | YES | config.e2e.test.ts |
| list: shows docsDir and tools | YES | config.e2e.test.ts |
| list: (none) when nothing installed | YES | config.e2e.test.ts |
| get: non-TTY without key exits 1 | YES | config.e2e.test.ts |
| get: docsDir | YES | config.e2e.test.ts |
| get: repo (default) | YES | config.e2e.test.ts |
| get: repo (saved via init --repo) | YES | config.e2e.test.ts |
| get: tools list | YES | config.e2e.test.ts |
| get: unknown key exits 1 | YES | config.e2e.test.ts |
| set: non-TTY without args exits 1 | YES | config.e2e.test.ts |
| set: docsDir with --force | YES | config.e2e.test.ts |
| set: no-op when value unchanged | YES | config.e2e.test.ts |
| set: non-TTY without --force exits 1 | YES | config.e2e.test.ts |
| set: read-only key rejected | YES | config.e2e.test.ts |
| set: unknown key rejected | YES | config.e2e.test.ts |
| set: warning when dir does not exist | YES | config.e2e.test.ts |
| set: no warning when dir exists | YES | config.e2e.test.ts |
| set: repo with --force | YES | config.e2e.test.ts |
| set: invalid repo format rejected | YES | config.e2e.test.ts |
| set: no manifest exits 1 | YES | config.e2e.test.ts |

### `aidd self-update` (self-update.ts)
Flags: `--check`, `--dry-run`, `--force/-f`

| Scenario | Covered | File |
|---|---|---|
| --help shows flags | YES | self-update.e2e.test.ts |
| --check in non-network test environment | MISSING | — |
| --dry-run in non-network test environment | MISSING | — |

### Global Options
Flags: `--verbose`, `--token`, `--repo`, `--version/-V`

| Scenario | Covered | File |
|---|---|---|
| --version format | YES | global-options.e2e.test.ts |
| --help lists public commands | YES | global-options.e2e.test.ts |
| --help does NOT show hidden commands (adopt, init) | MISSING | — |
| Unknown command exits with error | YES | global-options.e2e.test.ts |
| init --help shows flags | YES | global-options.e2e.test.ts |
| config --help shows subcommands | YES | global-options.e2e.test.ts |
| --verbose install lists files | YES | global-options.e2e.test.ts |

## Summary of Missing Tests

### High Priority (behavior correctness)

1. **status: --docs filter** — Confirms `--docs` flag scopes output to docs section only
2. **status: --tool and --docs mutually exclusive** — Error case
3. **update: --tool scope** — Confirms only target tool is updated, others unchanged
4. **update: --docs scope** — Confirms only docs section is updated
5. **update: --tool and --docs mutually exclusive** — Error case exits 1
6. **restore: --docs scope** — Confirms only docs are restored
7. **restore: --tool and --docs mutually exclusive** — Error case exits 1
8. **clean: non-TTY dry-run shows "Would remove"** — Distinct non-TTY output path

### Medium Priority (completeness)

9. **install: opencode tool** — Missing tool coverage (only claude/cursor/copilot tested)
10. **install: --all with explicit tools warns** — Warn message coverage
11. **uninstall: --all with no tools installed reports success** — Edge case
12. **global: --help hides adopt and init** — Confirm hidden commands not shown

## Documentation Assessment

The docs in `aidd_docs/memory/project_brief.md` and `aidd_docs/memory/architecture.md` accurately reflect the current codebase state:

- Commands listed match `src/application/commands/` contents
- `setup` is described as the single onboarding entry point (correct)
- `adopt` and `init` correctly described as hidden/internal
- Flags documented match the command implementations
- `--path` and `--release` correctly scoped to command-level (not global) per recent refactor

No documentation updates needed.
