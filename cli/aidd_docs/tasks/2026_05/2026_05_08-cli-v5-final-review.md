# CLI v5 Final Review

## Summary

- Code review: PASS (2 minor non-blocking findings)
- Functional review: FAIL (Scenario 5 is a confirmed blocker)
- Production-ready: NO — one blocker (setup non-idempotency with release change)

## Code review findings

| Axis | Status | Issues |
|---|---|---|
| Domain purity | PASS | `rg "from \"\.\./\.\./application\|node:fs\|node:os\|node:child_process\|process\.env" src/domain/` returns 0 matches |
| Application layer — use-cases | PASS | No adapter imports in `src/application/use-cases/` |
| Application layer — commands | NOTE (compliant) | `src/application/commands/auth.ts` imports 5 adapters directly. Compliant: commands are wire-layer per `0-deps-wiring.md` rule |
| Method size (>20 lines) | NEEDS WORK | `src/application/use-cases/sync/sync-file-propagation-use-case.ts:58` `syncAllTargets` (23 lines). `src/application/use-cases/restore/restore-use-case.ts:83` `execute` (25 lines). Non-blocking |
| Single execute per use-case | PASS | `sync-use-case.ts` has private helpers `executeToolSync` + `executePluginSync`, only one public `execute`. Same for `restore-use-case.ts`. 77 use-case classes, 71 public `execute` signatures — delta explained by shared/base classes with no execute |
| Use-case structure | PASS | All sub-use-cases placed under scope subdirs (`sync/`, `install/`, `auth/`, `doctor/`, `plugin/`, `marketplace/`, etc.) |
| Mega use-cases (>300 LOC) | NEEDS WORK | `src/application/use-cases/sync/sync-file-propagation-use-case.ts`: 517 lines. Non-blocking |
| Tests — skip count | PASS | 0 skips, 0 todos |
| Tests — pyramid ratio | PASS | 90 unit, 22 integration, 11 e2e (12 files total under `tests/e2e/`). Pyramid shape correct |
| Tests — wall clock | PASS | `pnpm test`: 10.63s (wall clock 12s). Well under 30s budget |
| Tests — persona E2E | PASS | `tests/e2e/persona.e2e.test.ts` covers banner, fresh setup, settings written, plugin tracking |
| Bundle | PASS | 462.4 KB / 500 KB budget |
| Knip:production | PASS | Exit 0, no unused exports |
| Build | PASS | Clean, no errors |
| Settings sync — claude | PASS | `settingsPath: ".claude/settings.json"`, `settingsKey: "extraKnownMarketplaces"`, `enabledPluginsKey: "enabledPlugins"`. Verified in Scenario 1 output |
| Settings sync — copilot | PASS | `settingsPath: ".github/copilot/settings.json"` |
| Settings sync — cursor | PASS | `settingsPath: ".cursor/settings.json"` |
| Settings sync — codex | PASS | `settingsPath: ".codex/config.json"` |
| Settings sync — opencode | PASS | `mode: "flat"`, no `marketplaceSettings` field (comment in code confirms intentional). Flat files materialized under `.opencode/agents/` and `.opencode/skills/` |
| CLI surface — removed commands | PASS | `aidd cache/config/install/uninstall` all return `error: unknown command`. `aidd --repo` returns `error: unknown option '--repo'` |
| CLI surface — noun-first | PASS | `aidd ai/ide/plugin/marketplace --help` all show subcommands |
| CLI surface — setup flags | PASS | `--source`, `--release` present. `--from`, `--switch-mode`, `--mode` absent. Note: spec listed `--release` as both expected and removed — actual surface has it present (correct behavior: pins marketplace tag) |
| Documentation — README | PASS | Install snippet correct (`npm install -g @ai-driven-dev/cli@latest`), v5 surface examples shown |
| Documentation — CHANGELOG | PASS | `## [4.1.0] — Unreleased — Noun-first surface + plugin architecture (CLI v5)` at line 3 |
| Documentation — MIGRATION | PASS | `MIGRATION.md` exists, covers breaking command + flag + manifest schema changes |
| Documentation — aidd_docs/memory | PASS | Memory files present: `architecture.md`, `codebase_map.md`, `deployment.md`, `testing.md`, etc. |

## Functional review findings

| Scenario | Status | Notes |
|---|---|---|
| 1: Greenfield local setup all tools + plugins | PASS | 4 settings files written (`.claude/settings.json`, `.cursor/settings.json`, `.github/copilot/settings.json`, `.codex/config.json`). Opencode flat files under `.opencode/`. Manifest v5 schema. `extraKnownMarketplaces` + `enabledPlugins` populated in all 4 settings files |
| 2: Remote with --release pinned | PASS | `settings.json` has `source: github`, `ref: v4.1.0-beta.18`. 5 plugins installed for claude |
| 3: Migration v2 manifest → v5 | PASS | Tested with v2 format (has `repo`, `mergeFiles`, `docs`, `scripts` fields). Backup created at `.aidd/manifest.json.bak.<timestamp>`. `repo` field stripped, `version` upgraded to 5. Warning: plugin with local source cannot be re-installed from marketplace (expected, not a bug) |
| 4: Plugin install standalone (post-setup) | PASS | `aidd plugin list` shows 5 plugins per tool after Scenario 1 setup |
| 5: Idempotency — re-run setup with different --release | FAIL | After `setup --release v4.1.0-beta.18`, re-running `setup --release v4.1.0-beta.20` exits 1: `Error: Plugin 'aidd-context' is already installed.` The `ref` in `settings.json` remains `v4.1.0-beta.18` — not updated to `beta.20`. Setup is not idempotent and does not support release pinning changes post-install |
| 6: aidd alone fresh (banner + setup prompt) | PARTIAL | Non-TTY: shows help (expected). TTY path: `tests/e2e/persona.e2e.test.ts` confirms banner text and setup prompt via `expect` script. Cannot replicate TTY interactively from reviewer context, but automated e2e passes |
| 7: Removed commands reject | PASS | All 5 removed surfaces error cleanly: `cache`, `config`, `install`, `uninstall`, `--repo` |

## Blockers

1. **Scenario 5 — `aidd setup` cannot change `--release` on an existing install** (`src/application/use-cases/setup-use-case.ts`): Running `setup --source remote --release v4.1.0-beta.20` on a project already set up with `beta.18` exits 1: `Error: Plugin 'aidd-context' is already installed.` The `ref` in `settings.json` is NOT updated. The spec says "Re-run setup with different `--release` → verify ref updated." This fails. Severity: high — setup is the primary user-facing command; changing the pinned release is a first-class use case.

## Improvements (non-blocking)

1. **Method size violations**: `src/application/use-cases/sync/sync-file-propagation-use-case.ts:58` `syncAllTargets` (23 lines) and `src/application/use-cases/restore/restore-use-case.ts:83` `execute` (25 lines). Both just above the 20-line guideline.
2. **Mega use-case**: `src/application/use-cases/sync/sync-file-propagation-use-case.ts` at 517 lines. Consider extracting content-transform or hash-comparison logic into a sub-use-case.
3. **Migration warning UX**: `Warning: Plugin "aidd-context" could not be re-installed from marketplace.` is printed when migrating local-path plugins, but the output does not tell users how to proceed (`aidd plugin add <source>`). Adding a hint would reduce confusion.

## Verdict

Commit `ac6c9ed`. Code quality is high across all axes: domain purity clean, use-case structure correct, test pyramid healthy (1347 tests, 0 skips, 12s wall clock), build and knip clean, all documentation present. One confirmed functional blocker: `aidd setup` cannot change the pinned `--release` on an already-configured project — re-running with a different tag exits 1 with "already installed" and leaves `settings.json` unchanged. This breaks a first-class user workflow (pinning or changing the framework version). **Production-ready: NO** until this path either errors gracefully with a clear `aidd update --release` instruction, or `setup` treats an existing install as an update operation when a new `--release` is provided.
