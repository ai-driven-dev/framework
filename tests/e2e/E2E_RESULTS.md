# AIDD CLI — E2E Test Results

> Reference: `tests/e2e/E2E_MAP.md`
> Run date: 2026-05-03 (real-env re-run post plugin-architecture refactor)
> CLI version: aidd/4.1.0
> Framework: main (local path, v3.9.1)

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Pass — output matches expected |
| ❌ | Fail — unexpected output or wrong exit code |
| ⚠️ | Pass with note — works but minor deviation |
| ⏭️ | Skipped — interactive-only or destructive binary install |

---

## Environment

```
CLI:       node /…/cli/dist/cli.js  (v4.1.0)
FRAMEWORK: /…/framework  (local, v3.9.1, 4 plugins)
OS:        darwin arm64
Node:      25.8.0
Auth:      gh CLI authenticated as blafourcade
```

---

## Global

| # | Result | Notes |
|---|--------|-------|
| G1 | ✅ | `aidd/4.0.0 node/25.8.0 darwin-arm64`, exit 0 |
| G2 | ✅ | `--verbose` shows `[verbose]` prefixed file-level output |
| G3 | ✅ | `--repo + --release v3.9.1` downloads + installs 59 files; `--release latest` routes to fetchLatestRelease, exit 0 |

---

## `aidd setup`

| # | Result | Notes |
|---|--------|-------|
| S1 | ✅ | `--ai claude --path <fw>` → 10 files, manifest + marketplace created |
| S2 | ✅ | `--all --path <fw>` → 36 files across 6 tools |
| S3 | ✅ | Re-run same setup → "All installed tools are up to date." |
| S4 | ⏭️ | Requires two different framework versions |
| S5 | ✅ | `--docs-dir custom_docs` → docs in `custom_docs/` |
| S6 | ✅ | `--ai cursor,claude` → both tools, ~20 files |
| S7 | ✅ | `--from v3.0.0 --release v3.9.1 --ai claude --yes` → adopt flow, 59 files, exit 0 |
| S8 | ⚠️ | No args + no auth → "Not authenticated" exit 1 (source-required error hidden behind auth check) |
| S9 | ✅ | `--release latest` with isolated HOME → "Not authenticated" exit 1 |

---

## `aidd install`

| # | Result | Notes |
|---|--------|-------|
| I1 | ✅ | `install ai claude --path <fw>` → 10 files, exit 0 |
| I2 | ✅ | `install ai cursor --path <fw>` → 10 files in `.cursor/rules/`, exit 0 |
| I3 | ✅ | `install ai copilot --path <fw>` → 2 files with vscode / 1 file + warning without, exit 0 |
| I4 | ✅ | `install ai opencode --path <fw>` → 11 files (`opencode.json` + `.opencode/rules/`), exit 0 |
| I5 | ⚠️ | `install ai codex --path <fw>` → 0 files + "no markdown rules equivalent" warning, exit 0 |
| I6 | ✅ | `install ide vscode --path <fw>` → 3 files (extensions, keybindings, settings), exit 0 |
| I7 | ✅ | `install --all --path <fw>` → all tools installed (claude skipped with warning if already installed) |
| I8 | ✅ | Install twice (no `--force`) → "Warning: already installed. Use --force", exit 0 |
| I9 | ✅ | `--force` → reinstalls 10 files, exit 0 |
| I10 | ✅ | `--no-plugins` → tool files only, no plugins dir created, exit 0 |
| I11 | ⏭️ | Interactive |
| I12 | ⚠️ | `--mcp playwright` → 10 files installed, no `.mcp.json` (playwright not in framework config), exit 0 |
| I13 | ✅ | `--plugins aidd-dev` → aidd-dev in `.claude/plugins/aidd-dev/`, exit 0 |
| I14 | ✅ | `--all-plugins` → all 4 plugins installed, exit 0 |
| I15 | ⚠️ | No path/release/manifest → "Not authenticated" exit 1 (tries GitHub; source-required error never surfaces) |
| I16 | ✅ | `install ai claude --release v3.9.1` with auth → downloads + installs 59 files, exit 0 |
| I17 | ✅ | `--plugins + --all-plugins` → "Error: mutually exclusive", exit 1 |

---

## `aidd uninstall`

| # | Result | Notes |
|---|--------|-------|
| U1 | ✅ | Install claude+plugins → uninstall → 10 files removed, plugin dir deleted, manifest cleared, exit 0 |
| U2 | ✅ | `uninstall --all` → 35 files removed, exit 0 |
| U3 | ✅ | `uninstall --plugin aidd-dev` → plugin removed (45 files), base claude kept, exit 0 |
| U4 | ✅ | `uninstall --mcp playwright` alone → defaults to all installed tools, removes MCP entry, exit 0 |
| U5 | ✅ | Uninstall not-installed → "Error: claude is not installed", exit 1 |
| U6 | ⏭️ | Interactive |

---

## `aidd update`

| # | Result | Notes |
|---|--------|-------|
| UP1 | ✅ | Same version → "Already up to date (v3.9.1)", exit 0 |
| UP2 | ⏭️ | Requires two framework versions |
| UP3 | ✅ | `--dry-run` + modified file → shows `~ file [conflict]`, no writes, exit 0 |
| UP4 | ✅ | `--tool claude --path <fw>` → "Already up to date (v3.9.1)", exit 0 |
| UP5 | ✅ | `--docs --path <fw>` → "Already up to date (v3.9.1)", exit 0 |
| UP6 | ✅ | `--tool + --docs` → "Error: mutually exclusive", exit 1 |
| UP7 | ⏭️ | Interactive |
| UP8 | ✅ | Modify file + `--force --path <fw>` → overwrites with `.bak` backup, "Updated 1 file", exit 0 |
| UP9 | ✅ | `update --release v3.9.1` with auth → downloads + updates 90 files, deletes 13 stale, exit 0 |

---

## `aidd restore`

| # | Result | Notes |
|---|--------|-------|
| R1 | ✅ | Nothing modified → "Nothing to restore — all files are unmodified.", exit 0 |
| R2 | ✅ | Modified file → restored, status clean after, exit 0 |
| R3 | ✅ | Deleted file → recreated, status clean after, exit 0 |
| R4 | ✅ | Specific file path → only that file restored, exit 0 |
| R5 | ✅ | `--tool claude` → only claude files, exit 0 |
| R6 | ✅ | `--docs` → only docs, exit 0 |
| R7 | ✅ | `--tool + --docs` → "Error: mutually exclusive", exit 1 |
| R8 | ✅ | `--plugin aidd-dev` → plugin files re-fetched, exit 0 |
| R9 | ✅ | Non-interactive, no `--force` → "Error: Use --force to overwrite modified files", exit 1 |
| R10 | ✅ | `--path <fw> --force` same version → "Nothing to restore", exit 0 |

---

## `aidd status`

| # | Result | Notes |
|---|--------|-------|
| ST1 | ✅ | Clean install → "All files are in sync.", exit 0 |
| ST2 | ✅ | Modified file → shows `~`, "1 modified", exit 0 |
| ST3 | ✅ | Deleted file → shows `-`, "1 deleted", exit 0 |
| ST4 | ⚠️ | User-added file shown as `+` (E2E_MAP says should not show — may be intentional) |
| ST5 | ✅ | `status ai` → only AI tools shown, exit 0 |
| ST6 | ✅ | `status ide` → only IDE tools shown, exit 0 |
| ST7 | ✅ | `status --docs` → only docs shown, exit 0 |
| ST8 | ✅ | Plugin installed + `status --plugin aidd-dev` → "All files are in sync.", exit 0 |
| ST9 | ✅ | No manifest → "Error: No AIDD manifest found", exit 1 |

---

## `aidd doctor`

| # | Result | Notes |
|---|--------|-------|
| D1 | ✅ | Local `--path` install: "Installation is healthy" exit 0; tasks/ files skipped in broken-ref check |
| D2 | ✅ | Corrupt manifest.json → "Error: Manifest is corrupted (invalid JSON)", exit 1 |
| D3 | ⏭️ | Hard to reproduce |
| D4 | ⏭️ | Hard to reproduce |
| D5 | ✅ | Modified tracked file → doctor shows "Modified tracked file: …" warning, exit 1 |
| D6 | ✅ | `doctor ai` → "Installation is healthy (59 files tracked across 1 tool)", exit 0 |
| D7 | ✅ | `doctor ide` with vscode → "Installation is healthy (3 files tracked across 1 tool)", exit 0 |
| D8 | ✅ | Local `--path`: healthy exit 0 (tasks/ skipped); `--release`: healthy, exit 0 |
| D9 | ✅ | Isolated HOME → "Warning: Not authenticated / Fix: Run aidd auth login", exit 0 |
| D10 | ✅ | No manifest → "Error: No AIDD manifest found", exit 1 |

---

## `aidd clean`

| # | Result | Notes |
|---|--------|-------|
| CL1 | ✅ | `clean --force` → 27 files removed, manifest removed, exit 0 |
| CL2 | ⏭️ | Interactive |
| CL3 | ✅ | No manifest → "Nothing to clean. No AIDD installation found.", exit 0 |
| CL4 | ✅ | User files preserved, framework files deleted, exit 0 |

---

## `aidd sync`

| # | Result | Notes |
|---|--------|-------|
| SY1 | ✅ | Claude+cursor installed → modify claude rule → `sync --source claude` → "Synced 1 file", exit 0 |
| SY2 | ✅ | `--source claude --target cursor` → syncs 1 modified file to cursor `.mdc`, exit 0 |
| SY3 | ⏭️ | Interactive conflict resolution |
| SY4 | ✅ | `sync --plugin aidd-dev` → "Plugin aidd-dev manifest updated" exit 0; re-hashes plugin in manifest (per spec — no cross-tool copy) |
| SY5 | ✅ | Only claude installed → "Error: Sync requires at least 2 installed tools.", exit 1 |
| SY6 | ⏭️ | Interactive multi-select |
| SY7 | ✅ | Non-interactive, no `--source` → "Error: --source <tool> is required.", exit 1 |

---

## `aidd auth`

| # | Result | Notes |
|---|--------|-------|
| A1 | ✅ | Isolated HOME → "Not authenticated.", exit 0 |
| A2 | ✅ | `auth login --token $(gh auth token) --level user` → "Authenticated as blafourcade (user)", exit 0 |
| A3 | ✅ | `auth login --gh --level user` → authenticated (requires `gh` CLI; fails with isolated HOME) |
| A4 | ✅ | `--token + --gh` → "Error: --gh and --token are mutually exclusive.", exit 1 |
| A5 | ✅ | `--level user` → stored in `~/.config/aidd/auth.json`, exit 0 |
| A6 | ✅ | `--level project` → stored in `.aidd/auth.json`, exit 0 |
| A7 | ✅ | `auth logout` → "Logged out (user)", status → "Not authenticated.", exit 0 |
| A8 | ✅ | After login → "Authenticated as blafourcade (user)", exit 0 |
| A9 | ✅ | `--token invalid_xyz --level user` → "Error: Authentication failed (HTTP 401).", exit 1 |

---

## `aidd config`

| # | Result | Notes |
|---|--------|-------|
| CF1 | ✅ | Shows `docsDir`, `repo`, `tools`, exit 0 |
| CF2 | ✅ | Prints current value, exit 0 |
| CF3 | ✅ | Prints installed tools summary, exit 0 |
| CF4 | ✅ | Prints repo or blank, exit 0 |
| CF5 | ⚠️ | `config set docsDir x` without `--force` → "Confirmation required" exit 1 (non-interactive; no prompt) |
| CF6 | ⚠️ | `config set repo x` without `--force` → "Confirmation required" exit 1 (non-interactive; no prompt) |
| CF7 | ✅ | `config set --force docsDir x` → no prompt, exit 0 |
| CF8 | ✅ | No manifest → "Error: No AIDD manifest found", exit 1 |
| CF9 | ✅ | Unknown key → "Error: Unknown key. Valid keys: docsDir, repo, tools.", exit 1 |

---

## `aidd marketplace`

| # | Result | Notes |
|---|--------|-------|
| M1 | ✅ | `marketplace add <fw> --name testfw --yes` → "Marketplace 'testfw' registered.", exit 0 |
| M2 | ✅ | `--user` → registered in `~/.config/aidd/marketplaces.json` with scope=user, exit 0 |
| M3 | ✅ | `marketplace list` → shows all with `[project]`/`[user]` scope, exit 0 |
| M4 | ✅ | `marketplace remove testfw --yes` → "Marketplace removed (0 plugin(s) cleaned up).", exit 0 |
| M5 | ✅ | `marketplace browse testfw` → shows `name@1.0.0 description path (recommended)`, exit 0 |
| M6 | ✅ | `marketplace refresh` → `framework: ok`, `testfw: ok`, exit 0 |
| M7 | ✅ | `marketplace refresh testfw` → `testfw: ok`, exit 0 |
| M8 | ✅ | After refresh → "All marketplaces fresh.", exit 0 |
| M9 | ✅ | After `setup`, marketplace auto-refreshed immediately — no longer stale |
| M10 | ✅ | Add same name twice → "Error: already registered.", exit 1 |
| M11 | ✅ | `--overwrite` → "Marketplace 'testfw' registered.", exit 0 |
| M12 | ✅ | Bad path → "Error: local path does not exist", exit 1 |
| M13 | ✅ | Browse nonexistent → "Error: not registered.", exit 1 |
| M14 | ✅ | `setup --path <fw>` → `framework` auto-registered in `.aidd/marketplaces.json`, exit 0 |

---

## `aidd plugin`

| # | Result | Notes |
|---|--------|-------|
| P1 | ✅ | `plugin add <path> --tool claude` → "Plugin added successfully.", files in `.claude/plugins/aidd-dev/`, exit 0 |
| P2 | ✅ | `plugin add <path>` (no `--tool`) → installed for every installed AI tool, exit 0 |
| P3 | ✅ | `plugin add <path> --tool cursor` → `.cursor/plugins/aidd-dev/`, MCP as `mcp.json` (no dot), exit 0 |
| P4 | ✅ | `plugin list` → shows all plugins with version per tool, exit 0 |
| P5 | ✅ | `plugin list --tool claude` → only claude plugins, exit 0 |
| P6 | ✅ | `plugin install aidd-dev --tool claude` → "Installed 'aidd-dev' from 'framework'", exit 0 |
| P7 | ✅ | 2 matching marketplaces → "Error: multiple marketplaces. Use --from.", exit 1 |
| P8 | ✅ | `plugin install aidd-pm --from framework --tool claude` → installed from specific marketplace, exit 0 |
| P9 | ✅ | `plugin install nonexistent --tool claude` → "Error: plugin not found in any marketplace.", exit 1 |
| P10 | ✅ | `plugin search sdlc` → shows matching plugins from all marketplaces, exit 0 |
| P11 | ⚠️ | `--recommended` works but same plugin shown twice when in two marketplaces (dedup missing) |
| P12 | ✅ | `plugin search sdlc --marketplace framework` → only from framework, exit 0 |
| P13 | ✅ | `plugin update aidd-dev --tool claude` → "All plugins are up to date.", exit 0 |
| P14 | ✅ | `plugin update` (all) → "All plugins are up to date.", exit 0 |
| P15 | ✅ | `plugin remove aidd-dev --tool claude` → "Plugin 'aidd-dev' removed.", manifest updated, exit 0 |
| P16 | ✅ | aidd-context for claude → `hooks.json` + `update_memory.js` in `.claude/plugins/aidd-context/hooks/`, exit 0 |
| P17 | ✅ | aidd-context for cursor → `hooks.json` + `update_memory.js` in `.cursor/plugins/aidd-context/hooks/`, exit 0 |
| P18 | ✅ | aidd-dev for claude → `.mcp.json` (dot prefix) in `.claude/plugins/aidd-dev/`, exit 0 |
| P19 | ✅ | aidd-dev for cursor → `mcp.json` (no dot) in `.cursor/plugins/aidd-dev/`, exit 0 |

---

## `aidd cache`

| # | Result | Notes |
|---|--------|-------|
| CA1 | ✅ | No cache → "No cached framework versions found.", exit 0 |
| CA2 | ✅ | After `install --release v3.9.1` → `cache list` shows `3.9.1  191.7 KB  /…/.aidd/cache/3.9.1`, exit 0 |
| CA3 | ✅ | `cache clear 3.9.1` and `cache clear v3.9.1` both succeed — `v` prefix stripped before lookup |
| CA4 | ✅ | `cache clear --all` → "Cleared all cached framework versions", exit 0 |
| CA5 | ✅ | `cache clear v9.9.9` → "Error: No cached framework found for version 'v9.9.9'", exit 1 |
| CA6 | ✅ | `cache clear` (no args, non-interactive) → "Error: Specify a version or --all in non-interactive mode.", exit 1 |

---

## `aidd self-update`

| # | Result | Notes |
|---|--------|-------|
| SU1 | ✅ | `self-update --check` with auth → "Already up to date (4.0.0)", exit 0 |
| SU2 | ✅ | Shows current vs latest (same), exit 0 |
| SU3 | ✅ | `--dry-run` → "Already up to date (4.0.0)", exit 0 |
| SU4 | ⏭️ | Would modify binary |
| SU5 | ⏭️ | Would modify binary |

---

## Cross-cutting

| # | Result | Notes |
|---|--------|-------|
| X1 | ✅ | setup → plugin install → status → "All files are in sync", exit 0 |
| X2 | ✅ | install + modify + status (`~`) + `restore --path <fw> --force` → status clean, exit 0 |
| X3 | ✅ | Multi-tool setup → edit claude rule → `sync --source claude --force` → cursor `.mdc` updated, exit 0 |
| X4 | ✅ | marketplace add → plugin install → plugin list → plugin remove → marketplace remove → clean state |
| X5 | ✅ | `plugin install aidd-context --tool claude` → `hooks.json` + `update_memory.js` in `.claude/plugins/aidd-context/hooks/` |
| X6 | ✅ | `clean --force` → `setup` → 31 files reinstalled, status clean |
| X7 | ✅ | Delete tracked file → `doctor` error (exit 1) → `restore --path <fw> --force` → doctor healthy (exit 0) |
| X8 | ⚠️ | `config set docsDir docs --force` → `update --docs` → docs in `docs/`; old `aidd_docs/CATALOG.md` physically remains (not tracked, not cleaned) |
| X9 | ✅ | `auth login --gh --level user` → `setup --release v3.9.1 --ai claude --yes` → 59 files installed, exit 0 |
| X10 | ✅ | `setup` auto-registers `framework` → second marketplace at same path → install without `--from` → Error → `--from framework` resolves, exit 0 |

---

## Bug fixes applied during this E2E session

| ID | Bug | Status |
|----|-----|--------|
| BUG-1 | Copilot rules not installing: `RulesCapability.acceptsFileName()` used wrong suffix | ✅ Fixed (commits 38800e7, 7b93fb5) |
| BUG-copilot-update | `update-use-case.ts` unused params caused build warning | ✅ Fixed (commit 7b93fb5) |
| A1-fix | `auth status` threw exit 1 when not authenticated | ✅ Fixed — discriminated union on `AuthStatus`, adapter returns `{ authenticated: false }` |
| SY1/SY2-fix | Sync didn't detect modifications: `frameworkPath` key mismatch (`.claude.md` vs `.cursor.md`) | ✅ Fixed — `canonicalFrameworkKey()` strips tool suffix at map build + both lookup sites |
| U1-fix | Plugin files not deleted on `uninstall ai <tool>` | ✅ Fixed — `removePluginFiles()` iterates manifest plugins before `removeTool()` |
| BUG-2 | `--release latest` produced `vlatest` — `normalizeTag()` now returns `undefined` for `"latest"` | ✅ Fixed |
| BUG-3 | `cache clear v3.9.1` failed — `v` prefix now stripped before cache lookup | ✅ Fixed |
| BUG-5 | `doctor` reported healthy on modified tracked files | ✅ Fixed — `checkModifiedTrackedFiles()` added, warns on hash drift |
| BUG-6 | `uninstall --mcp` required explicit tool arg | ✅ Fixed — defaults to all installed tools when no tool args |
| P17-fix | Cursor plugin hooks at plugin root, not `hooks/` subdir | ✅ Fixed — removed explicit `hooksRelativePath: "hooks.json"` override in cursor.ts |
| D1/D8-fix | `doctor` raised broken-ref warnings for `aidd_docs/tasks/` dev plan files | ✅ Fixed — `checkBrokenReferences()` skips paths containing `/tasks/` |
| K1-fix | `marketplace browse` showed `@?` — no version in catalog | ✅ Fixed — added `version` to `marketplace.json` entries in framework |
| K2-fix | Marketplace stale immediately after `setup` | ✅ Fixed — `setup.ts` calls `marketplaceRefreshUseCase` after successful registration |
| K3-fix | Local `--path` install copied `aidd_docs/tasks/` dev plans to user projects | ✅ Fixed — docs file loader excludes `tasks/` prefix |
| K5-fix | `aidd-context/hooks.json` used wrong format (array) for Claude Code and Copilot | ✅ Fixed — object map format with `${CLAUDE_PLUGIN_ROOT}` path |

---

## Open issues

| ID | Issue | Severity |
|----|-------|----------|
| K5-cursor | Cursor plugin hooks installed but schema differs (`version:1`, camelCase events) — hooks won't execute | Low |
| K5-opencode | OpenCode plugins are JS/TS modules — `hooks.json` approach incompatible by design | Expected |
| K5-codex | Codex has native hooks but plugins don't expose them — by design | Expected |
| I11/U6/UP7 | Interactive flows not covered (TTY required) | Expected (out of scope) |

---

## Real-env re-run — 2026-05-03 (plugin-architecture refactor)

> New in v4.1.0: two distribution modes (`local` / `remote`). Default is `local`.
> Local mode copies `./plugins/` from framework to project root.
> Remote mode installs plugins per-tool under `.claude/plugins/`, `.cursor/plugins/`, etc.

### Mode: local (default)

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| L1 | `setup --path <fw> --ai claude` | ✅ | `./plugins/` with 4 dirs at project root, `CLAUDE.md`, `.aidd/manifest.json`, marketplace registered |
| L2 | `plugins/aidd-context/`, `aidd-dev/`, `aidd-pm/`, `aidd-vcs/` present | ✅ | All 4 copied with full content (hooks, rules, agents, skills) |
| L3 | `.claude-plugin/marketplace.json` created | ✅ | 4-plugin catalog pointing to `./plugins/*` |
| L4 | `status` (clean state) | ✅ | "All files are in sync." |
| L5 | `clean --force` | ✅ | All files removed. `.gitignore` deleted (not zeroed — see BUG-7 fix) |

### Mode: remote

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| R1 | `setup --path <fw> --ai claude --mode remote` | ✅ | `CLAUDE.md`, `.claude/settings.json`, marketplace registered, exit 0 |
| R2 | Plugins NOT auto-installed on setup | ✅ | Expected — "Run `aidd plugin pick` to install plugins." message shown |
| R3 | `install ai cursor --path <fw>` (after claude remote setup) | ✅ | `.cursor/` dir + all 4 plugins in `.cursor/plugins/` |
| R4 | `plugin add <fw>/plugins/aidd-dev --tool claude` | ✅ | `.claude/plugins/aidd-dev/` created, `plugin list --tool claude` shows `aidd-dev@1.0.0` |
| R5 | `plugin install aidd-dev --tool claude` (from auto-registered GitHub marketplace) | ❌ | GitHub API skips `.claude-plugin/` (hidden dir) — `marketplace.json` not fetched. Workaround: use `marketplace add <name> <local-path>` |
| R6 | `marketplace add local-fw <fw> --name local-fw` → `plugin install aidd-dev` | ✅ | Installs from local path marketplace |
| R7 | `marketplace browse aidd-framework` (GitHub source) | ❌ | "marketplace.json not found" — same hidden dir issue |
| R8 | `marketplace browse local-fw` (local path) | ✅ | Lists 4 plugins with name/description/version |
| R9 | `update --path <fw>` (clean state) | ✅ | "Already up to date (v3.9.1)" |
| R10 | Modify `CLAUDE.md` → `update --path <fw> --force` | ✅ | File restored, `.bak` backup created |
| R11 | `uninstall ai claude` | ✅ | `CLAUDE.md` removed, manifest cleared. `settings.json` retained (untracked — expected) |
| R12 | `setup --ai claude,cursor --mode remote` → sync | ✅ | Both tools installed. `sync --source claude --force` propagates plugin file change to cursor |
| R13 | `clean --force` | ✅ | `CLAUDE.md` removed, `.aidd/` deleted, `.gitignore` deleted cleanly |

### Bug fixes found during this run

| ID | Bug | Status |
|----|-----|--------|
| BUG-7 | `clean --force` zeroed `.gitignore` (0 bytes) when `.aidd/cache/` was only entry — `GitignoreUseCase.remove()` wrote empty string instead of deleting | ✅ Fixed — `remove()` now deletes file when result is empty after filtering |
| BUG-update-plugin-scope | `updatePluginsForTool` reinstalled plugins for ALL installed AI tools instead of target tool only (UP8 scope) | ✅ Fixed — `toolConfigs: [getToolConfig(toolId)]` |
| BUG-update-false-uptodate | `update` always returned "Already up to date" after plugin-architecture refactor — empty MCP manifest entries + no regular framework files = no diff detected | ✅ Fixed — `markPluginDiffs()` detects catalog source path changes and overrides `alreadyUpToDate` |
| BUG-update-plugin-skip | Plugin reinstall ran even when sources matched (same v→v) | ✅ Fixed — `markPluginDiffs()` returns change map; `executeInternal()` filters to changed tools only |

### Remaining open issues (new)

| ID | Issue | Severity |
|----|-------|----------|
| MKTPL-1 | `marketplace browse` / `plugin install` fail for GitHub-sourced marketplace — GitHub API skips hidden dirs (`.claude-plugin/marketplace.json` unreachable) | Medium |
| STATUS-1 | `status` omits tools with no drift — cursor with 0 modified files not shown; only tools with changes appear | Low (UX) |
