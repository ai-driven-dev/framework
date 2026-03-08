# Local Audit Report — 2026-03-08

## Test Suite Results

### Run command

```
pnpm test
```

### Results

- **Test Files:** 39 passed (39 total)
- **Tests:** 404 passed (404 total)
- **Duration:** ~6s (build + test)
- **Failures:** 0

All 404 tests pass cleanly. The build (tsup) succeeds in ~17ms producing `dist/cli.js` at 86.17 KB.

---

## Command Coverage Matrix

| Command | Scenario | Result | Notes |
|---------|----------|--------|-------|
| `aidd --help` | Help output | PASS | Shows all commands and global options |
| `aidd` (no command) | No-op, shows help | PASS | Exits 0, displays usage |
| `aidd unknown-command` | Unknown command | PASS | `error: unknown command 'unknown-command'` |
| `aidd --version` | Version display | PASS | `aidd/3.0.0 node/24.13.0 darwin-arm64` |
| `aidd install --help` | Command help | PASS | Shows tools arg, --force, --all |
| `aidd init --help` | Command help | PASS | Shows --docs-dir, --force |
| `aidd status --help` | Command help | PASS | Shows --tool |
| `aidd uninstall --help` | Command help | PASS | Shows tools arg, --all |
| `aidd clean --help` | Command help | PASS | Shows --force |
| **INIT** | | | |
| `aidd init --framework <path>` | Fresh init | PASS | Creates aidd_docs/, .aidd/manifest.json, .gitignore |
| `aidd init --framework <path>` (again) | Re-run on existing | PASS | Error: "Already initialized..." exits 1 |
| `aidd init --force --framework <path>` | Force re-copy | PASS | Re-copies docs files, warns on modified |
| `aidd init --force` (no prior init) | Force without init | PASS | Error: "No AIDD installation found" exits 1 |
| `aidd init --docs-dir my_docs` | Custom docs dir | PASS | Creates my_docs/, manifest records docsDir |
| `aidd init --docs-dir "my docs!"` | Invalid dir name | PASS | Error: "Invalid directory name" exits 1 |
| `aidd --verbose init --framework <path>` | Verbose mode | PASS | Shows token resolution and framework path |
| **INSTALL** | | | |
| `aidd install claude --framework <path>` | Single tool | PASS | Creates .claude/, 61 files, auto-inits |
| `aidd install cursor --framework <path>` | Single tool | PASS | Creates .cursor/, 60 files |
| `aidd install copilot --framework <path>` | Single tool | PASS | Creates .github/, 55 files |
| `aidd install --all --framework <path>` | All tools | PASS | 176 files, CATALOG.md generated |
| `aidd install claude cursor --framework <path>` | Multiple tools | PASS | 121 files |
| `aidd install claude --force --framework <path>` | Force reinstall | PASS | Overwrites without error |
| `aidd install claude --framework <path>` (already installed) | Skip reinstall | PASS | Warning: "already installed. Use --force" |
| `aidd install claude --framework <path>` (no manifest) | Auto-init | PASS | "No installation found. Initializing docs first..." |
| `aidd install --verbose claude --framework <path>` | Verbose mode | PASS | Lists every file being written |
| `aidd install invalidtool` | Invalid tool | PASS | Error: "Unknown tool: invalidtool" exits 1 |
| `aidd install` (no tools, no --all) | Missing args | PASS | Error: "Specify at least one tool or use --all" exits 1 |
| `aidd install --framework /nonexistent` | Invalid path | PASS | Error: "Framework path does not exist" exits 1 |
| **UNINSTALL** | | | |
| `aidd uninstall claude` | Single tool | PASS | Removes .claude/, 61 files removed |
| `aidd uninstall cursor copilot` | Multiple tools | PASS | 115 files removed |
| `aidd uninstall --all` | All tools | PASS | Removes all installed tools |
| `aidd uninstall claude` (not installed) | Non-installed tool | PASS | Error: "claude is not installed" exits 1 |
| `aidd uninstall` (no prior init) | No manifest | PASS | Error: "No AIDD installation found" exits 1 |
| `aidd uninstall` (no args, no --all) | Missing args | PASS | Error: "Specify at least one tool or use --all" exits 1 |
| `aidd uninstall --all` (nothing installed) | Empty state | PASS | "No tools installed. Run `aidd install`..." exits 0 |
| Reinstall after uninstall (no --force) | Reinstall cycle | PASS | Works without --force since tool was uninstalled |
| **STATUS** | | | |
| `aidd status` (clean install) | No drift | PASS | "All files are in sync" |
| `aidd status` (modified file) | Modified drift | PASS | Shows `~ path/to/file`, counts |
| `aidd status` (deleted file) | Deleted drift | PASS | Shows `- path/to/file`, counts |
| `aidd status` (added untracked file) | Added drift | PASS | Shows `+ path/to/file`, counts |
| `aidd status` (docs file modified) | Docs drift | PASS | Shows `docs (v3.3.3): ~ file` |
| `aidd status --tool claude` | Tool filter | PASS | Filters output to claude only |
| `aidd status --tool invalidtool` | Invalid tool filter | PASS | Error: "Unknown tool: invalidtool" exits 1 |
| `aidd status` (only init, no tools) | No tools installed | PASS | "No tools installed. Run `aidd install`..." |
| `aidd status` (no init) | No manifest | PASS | Error: "No AIDD installation found" exits 1 |
| `aidd --verbose status` | Verbose | PASS | Shows token resolution, then status |
| **CLEAN** | | | |
| `aidd clean` | Dry-run (no --force) | PASS | Lists files, "Would remove X files. Use --force to confirm." |
| `aidd clean --force` | Full deletion | PASS | Removes all tracked files, .aidd/, CATALOG.md |
| `aidd clean --force` (nothing to clean) | Empty state | PASS | "Nothing to clean. No AIDD installation found." |
| `aidd clean` (only docs, no tools) | Docs-only clean | PASS | "Would remove 45 files across 0 tools" |
| `aidd clean --force` (only docs) | Docs-only force | PASS | "Removed docs files. Cleaned all AIDD files (45 files)" |
| `aidd --verbose clean` | Verbose dry-run | PASS | Shows token resolution before preview |
| **DOCTOR** | | | |
| `aidd doctor` (test fixture - healthy) | Healthy state | PASS | "Installation is healthy (N files)" exits 0 |
| `aidd doctor` (example framework) | Broken refs on fresh install | BUG | Exits 1 with 6 warnings — see Bug #1 |
| `aidd doctor` (corrupted manifest) | Corrupted JSON | PASS | "Manifest is corrupted" exits 1 |
| `aidd doctor` (no init) | No manifest | PASS | "No AIDD installation found" exits 1 |
| `aidd doctor` (broken @path ref) | Broken reference | PASS | Reports broken ref with fix hint |
| `aidd doctor` (orphaned directory) | Orphaned dir | PASS | Warns, exits 1 |
| `aidd --verbose doctor` | Verbose | PASS | Shows token resolution before checks |
| **GLOBAL OPTIONS** | | | |
| `aidd --verbose init --framework <path>` | Verbose at global level | PASS | Works same as placing verbose before subcommand |
| `aidd --release v3.3.3 install --all --framework <path>` | Release tag override | PASS | Installs with v3.3.3 tag in manifest |
| `AIDD_VERBOSE=true aidd install ...` | Env var verbose | PASS | Activates verbose output |
| **EDGE CASES** | | | |
| Full lifecycle (init → install → status → uninstall → clean) | Complete flow | PASS | All steps succeed |
| Install + modify + status (drift) + clean --force | Drift + clean | PASS | Drift detected, clean removes all |
| Double install without --force | Skip reinstall | PASS | Warning, exits 0, no overwrite |
| Install --all, check CATALOG.md | CATALOG generated | PASS | CATALOG.md at aidd_docs/CATALOG.md |
| Uninstall some tools, check CATALOG.md | CATALOG updated | PASS | Removed tool section disappears |
| `.aidd/manifest.json` after init | Manifest exists | PASS | JSON with version, docsDir, tools |
| `.aidd/settings.json` after init | Settings file | NOTE | Never created by CLI — read-only, user-managed |
| `.gitignore` after init | Gitignore entry | PASS | `.aidd/cache/` appended |
| `.gitignore` after clean --force | Gitignore cleanup | NOTE | Stale `.aidd/cache/` entry left — see Bug #3 |
| CATALOG.md in manifest | Not tracked | PASS | CATALOG.md correctly excluded from manifest |
| `aidd install --all` then `uninstall --all` then `install --all` | Full reinstall cycle | PASS | Works cleanly |

---

## Bugs Found

### Bug #1 — MAJOR: `doctor` always exits 1 on fresh install with real framework

**Severity:** Major

**Component:** `src/application/use-cases/init-use-case.ts`, `rewriteDocsContent()`

**Root cause:** `rewriteDocsContent()` (line 104) replaces `{{DOCS}}/` with `docsDir/` (e.g. `aidd_docs/`) for ALL docs files, including files that are themselves inside `docsDir/`. This produces broken relative markdown links.

Example: The README template at `aidd_docs/README.md` contains:

```markdown
[Full catalog]({{DOCS}}/CATALOG.md)
```

After `rewriteDocsContent`, it becomes:

```markdown
[Full catalog](aidd_docs/CATALOG.md)
```

But `doctor` resolves this relative link from the file's own directory (`aidd_docs/`), producing the path `{projectRoot}/aidd_docs/aidd_docs/CATALOG.md` — which does not exist, even though `{projectRoot}/aidd_docs/CATALOG.md` does.

**Reproduction steps:**

```bash
mkdir /tmp/fresh-project && cd /tmp/fresh-project
aidd install --all --framework example/aidd-framework-3.3.3
aidd doctor
# → 6 warnings, exits 1
```

**Expected:** `doctor` exits 0 with "Installation is healthy" on a fresh install.

**Actual:** `doctor` exits 1 with warnings about `aidd_docs/CATALOG.md`, `aidd_docs/rules/01-standards/1-command-structure.md`, and `aidd_docs/rules/01-standards/1-rule-structure.md` not found.

**Impact:** The CI health check use case (`aidd doctor` in CI pipeline) is broken for projects using the real AIDD framework.

**Fix:** In `rewriteDocsContent`, pass the file's output relative path and strip the `docsDir/` prefix from `{{DOCS}}/` references when the output file is itself inside `docsDir/`. Files inside `docsDir/` should have `{{DOCS}}/` replaced with `""` (so `{{DOCS}}/CATALOG.md` → `CATALOG.md`).

---

### Bug #2 — MAJOR: `{{TOOLS}}/` in docs replaced with `docsDir/` instead of tool directory

**Severity:** Major

**Component:** `src/application/use-cases/init-use-case.ts`, `rewriteDocsContent()`

**Root cause:** `rewriteDocsContent()` replaces both `{{DOCS}}/` and `{{TOOLS}}/` with `docsDir/`. But `{{TOOLS}}/` in doc files is meant to reference tool-specific files (e.g. `.claude/rules/`), not docs files.

Example: The README template has:

```markdown
[Command SDLC phases]({{TOOLS}}/rules/01-standards/1-command-structure.md)
```

After `rewriteDocsContent`, it becomes:

```markdown
[Command SDLC phases](aidd_docs/rules/01-standards/1-command-structure.md)
```

But the actual file is at `.claude/rules/01-standards/1-command-structure.md`. There is no `aidd_docs/rules/` directory.

**Impact:** Same as Bug #1 — `doctor` exits 1 on fresh installs. Additionally, the README links to rules are permanently broken from a user-experience standpoint (clicking them goes nowhere in any viewer).

**Fix:** Either:
- Remove `{{TOOLS}}/` cross-references from docs templates (docs should not link to tool-specific files), OR
- Implement separate substitution: `{{TOOLS}}/rules/` → `.claude/rules/` (or relative equivalent from the doc's position), per active tool context.

---

### Bug #3 — MINOR: `clean --force` leaves stale `.gitignore` entry

**Severity:** Minor

**Component:** `src/application/use-cases/clean-use-case.ts`

**Description:** `aidd init` writes `.aidd/cache/` to `.gitignore`. `aidd clean --force` removes the `.aidd/` directory and all tracked files but does NOT remove the `.gitignore` entry it added. After a full clean, `.gitignore` still contains `.aidd/cache/` even though `.aidd/` no longer exists.

**Reproduction:**

```bash
mkdir /tmp/test && cd /tmp/test
aidd init --framework example/aidd-framework-3.3.3
cat .gitignore   # contains: .aidd/cache/
aidd clean --force
cat .gitignore   # still contains: .aidd/cache/ (stale)
```

**Impact:** Low. The stale entry causes no errors but is confusing for users who inspect `.gitignore` after a clean.

---

### Bug #4 — MINOR: `.DS_Store` files from macOS framework directories are installed and tracked

**Severity:** Minor

**Component:** `src/infrastructure/adapters/framework-loader-adapter.ts`, `collectFiles()`

**Description:** The framework loader has no filtering for OS-specific files. When using `--framework` with a local macOS directory that contains `.DS_Store` files (macOS Finder metadata), those files are installed into the project and tracked in the manifest and CATALOG.md.

**Observed:** After `aidd install --all --framework example/aidd-framework-3.3.3`:
- `.claude/commands/.DS_Store` installed
- `.claude/rules/.DS_Store` installed
- `aidd_docs/.DS_Store` installed
- `aidd_docs/templates/.DS_Store` installed
- All four appear in CATALOG.md

**Impact:** Low when using GitHub Releases (tarballs don't include `.DS_Store`). However, any user using `--framework` with a local macOS directory will pollute their project with metadata files.

**Fix:** Add a filter in `collectFiles()` to skip `.DS_Store` and other OS-specific files (`.DS_Store`, `Thumbs.db`, etc.).

---

## Missing Test Coverage

| Gap | Description | Priority |
|-----|-------------|----------|
| `rewriteDocsContent()` behavior | No tests for `{{DOCS}}/` → relative path substitution for files inside `docsDir/` | High |
| `doctor` with real framework fixture | Tests use minimal `tests/fixtures/framework` without `README.md`; never catches the broken-link bug | High |
| `.DS_Store` filtering | No test asserting `.DS_Store` files are excluded from installation | Medium |
| `clean --force` `.gitignore` cleanup | No test verifying `.gitignore` entry is removed or left (implicit contract undefined) | Medium |
| `catalog-use-case.ts` unit test | `writeCatalog()` has no dedicated test file; covered only indirectly | Low |
| `status --tool <invalid>` in e2e | Manually verified but no e2e test for invalid tool filter | Low |
| `AIDD_VERBOSE` in memory docs | Not documented in `aidd_docs/memory/` files (only in source) | Low |

---

## Edge Case Results

| Edge Case | Result | Notes |
|-----------|--------|-------|
| `aidd init` on dir with existing `aidd_docs/` but no manifest | FAIL | "Directory aidd_docs already exists" — correct behavior |
| `aidd doctor` on fresh install (test fixture) | PASS | "Installation is healthy" exits 0 |
| `aidd doctor` on fresh install (example framework) | BUG | 6 warnings, exits 1 — see Bug #1 and #2 |
| CATALOG.md is NOT in manifest | PASS | Correctly not tracked |
| CATALOG.md is regenerated after each uninstall | PASS | Sections for removed tools disappear |
| `.aidd/settings.json` never created by CLI | NOTE | By design: read-only, user-managed. Not a bug. |
| `.gitignore` entry after clean | BUG | Stale `.aidd/cache/` entry remains — see Bug #3 |
| Double `aidd init` (without force) | PASS | Correctly blocked with clear message |
| `aidd uninstall --all` with nothing installed | PASS | Graceful: "No tools installed" |
| Reinstall (after uninstall, without --force) | PASS | Allowed — correct since tool was uninstalled |
| `aidd install --all` → `uninstall --all` → `install --all` | PASS | Full cycle works cleanly |
| `aidd --release v3.3.3 install` with local `--framework` | PASS | Version applied to manifest; local path used |
| `AIDD_VERBOSE=true` env variable | PASS | Activates verbose without `--verbose` flag |
| `aidd status` update-available check | INFO | Silent when network unavailable; no error |
| Invalid `--framework` path | PASS | "Framework path does not exist" exits 1 |

---

## Architecture vs Implementation Discrepancies

### Logger `info()` channel

`aidd_docs/memory/architecture.md` states:

> `info()` (stderr, always)

The actual `CLIOutput.info()` implementation writes to **stdout**, not stderr. This is the correct behavior (progress messages belong on stdout), but the documentation is wrong.

### `testing.md` fixture path

`aidd_docs/memory/testing.md` references `example/aidd-framework-3.2.3/` as the E2E fixture path. The actual directory is `example/aidd-framework-3.3.3/`. E2E tests use `tests/fixtures/framework` (not `example/`), so tests still pass, but the documentation is stale.

---

## Recommendations

### Priority 1 — Fix immediately

1. **Fix `rewriteDocsContent()` in `init-use-case.ts`**
   - For files inside `docsDir/`, replace `{{DOCS}}/` with `""` (not `docsDir/`)
   - For files outside `docsDir/`, keep replacing with `docsDir/`
   - This fixes Bug #1 and restores `doctor` for CI use cases
   - Add unit tests covering both scenarios

2. **Fix `{{TOOLS}}/` substitution in docs**
   - Either remove cross-references from docs to tool-specific files (simplest)
   - Or implement correct path substitution per output file location
   - Add unit tests for the new behavior

3. **Add `doctor` e2e test using the real example framework fixture**
   - Test should detect the broken-link scenario is fixed after Bug #1 and #2 resolution
   - Currently only `tests/fixtures/framework` (minimal, no README) is tested

### Priority 2 — Fix soon

4. **Filter `.DS_Store` files in `FrameworkLoaderAdapter.collectFiles()`**
   - Add `if (entry.name === '.DS_Store' || ...) continue;` check
   - Add test asserting `.DS_Store` files are not included in distribution

5. **`clean --force` should remove `.gitignore` entry**
   - The `.aidd/cache/` entry added by `init` should be cleaned by `clean --force`
   - Add to `CleanUseCase.execute()` (only when it was added by AIDD)

### Priority 3 — Documentation

6. **Update `aidd_docs/memory/architecture.md`**
   - `Logger.info()` writes to stdout, not stderr — fix the doc

7. **Update `aidd_docs/memory/testing.md`**
   - Reference is `example/aidd-framework-3.2.3/` but should be `example/aidd-framework-3.3.3/`
   - Also clarify: e2e tests use `tests/fixtures/framework`, not the `example/` directory

8. **Document `AIDD_VERBOSE` env variable**
   - Add to `aidd_docs/memory/architecture.md` or `aidd_docs/memory/deployment.md`
