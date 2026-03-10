# UX Copy - AIDD CLI

## Scope

**This document owns**: ALL user-facing text -- error messages, success messages, help descriptions, warnings, progress feedback, onboarding copy, confirmation messages.

**No other deliverable should contain exact user-facing text.** Other documents reference this one.

---

## 1. Voice and Tone

### Product Voice

AIDD CLI is a developer tool for a paid community of AI-assisted developers. The voice is:

- **Direct**: State what happened and what to do next. No filler.
- **Technical but clear**: Users are developers, but error messages should still be actionable, not cryptic.
- **Respectful of user time**: No unnecessary output. Every line of output earns its place.
- **Trustworthy**: The CLI manages files on the user's filesystem. Copy must convey safety and predictability.

### Tone Variations

| Context  | Tone                  | Do                                                                            | Don't                                                             |
| -------- | --------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Success  | Concise confirmation  | "Installed claude (42 files)"                                                 | "Great job! Claude has been successfully installed!"              |
| Error    | Direct and actionable | "Authentication failed. Run `gh auth login` or provide a token via `--token`" | "Oops! Something went wrong with your credentials"                |
| Warning  | Factual alert         | "Network unavailable. Using cached framework v3.1.0"                          | "Warning! Be careful, you are working offline!"                   |
| Progress | Minimal, informative  | "Downloading framework v3.2.0..."                                             | "Please wait while we download the framework for you..."          |
| Dry-run  | Descriptive preview   | "Would remove 42 files across 2 tools. Use `--force` to confirm."             | "Are you sure you want to do this? This action cannot be undone!" |

### Copy Principles

1. **Action over description**: Every error message includes what the user can do to fix it.
2. **No exclamation marks**: The CLI does not get excited or alarmed.
3. **No first person**: The CLI does not say "I" or "we". Use imperative or passive constructions.
4. **No emoji in output**: Text-only. Status indicators use ASCII characters (checkmark, cross, dash).
5. **Consistent terminology**: "tool" (not "assistant"), "distribution" (not "config"), "framework" (not "source"), "manifest" (not "config file").
6. **Trailing period convention**: Multi-sentence messages end with a period. Single-statement messages do not. Messages ending with a template variable list or usage pattern omit the trailing period.

---

## 2. Error Messages

### Framework Resolution Errors

| Key                                | Message                                                                                                      | Recovery action                                                | Context                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ |
| `error.auth.failed`                | Authentication failed. Run `gh auth login` to authenticate, or provide a token via `--token` or `AIDD_TOKEN`. | Authenticate via one of the listed methods                     | Private repo, no token available from any source             |
| `error.network.unreachable`        | Cannot reach the framework source. Check your network connection.                                            | Verify network or use `--framework` with local source          | Network failure, no cache available                          |
| `error.tarball.invalid`            | Downloaded file is not a valid tarball                                                                       | Re-download or provide a valid `.tar.gz` via `--framework`     | Corrupted download or wrong file format                      |
| `error.descriptor.missing_archive` | No framework descriptor found in the downloaded tarball                                                      | Verify the framework repository contains `framework.json`      | Tarball extracted but no `framework.json` at root            |
| `error.descriptor.missing_dir`     | No framework descriptor found in the specified directory                                                     | Verify the directory contains `framework.json`                 | `--framework` points to a directory without `framework.json` |
| `error.repo.invalid_format`        | Invalid repository format. Expected: owner/repo                                                              | Use format `owner/repo` (e.g., `ai-driven-dev/aidd-framework`) | `--repo` value does not match `owner/repo` pattern           |

### Init Errors

| Key                                 | Message                                                                                         | Recovery action                                                | Context                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `error.init.dir_exists`             | Directory "{dirName}" already exists                                                            | Remove the directory or use `--docs-dir` with a different name | Docs directory already present on disk               |
| `error.init.invalid_dir_name`       | Invalid directory name: "{dirName}". Use alphanumeric characters, hyphens, and underscores only. | Provide a valid directory name                                 | Special characters or path traversal in `--docs-dir` |
| `error.init.docs_dir_wrong_command` | `--docs-dir` is only valid with `aidd init`. Run `aidd init --docs-dir {dirName}` first.        | Use init command for custom docs dir                           | `--docs-dir` used on install or other command        |

### Install Errors

| Key                               | Message                                                     | Recovery action                   | Context                                 |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------- | --------------------------------------- |
| `error.install.no_args`           | Specify at least one tool or use --all. Valid tools: {validTools} | Provide one or more tool IDs or use `--all` | `aidd install` called with no arguments |
| `error.install.unknown_tool`      | Unknown tool: {toolId}. Valid tools: {validTools}           | Use a valid tool ID from the list | Invalid tool ID provided                |
| `error.install.already_installed` | {toolId} is already installed. Use `--force` to reinstall.  | Add `--force` flag to overwrite   | Tool already in manifest, no `--force`  |

### Uninstall Errors

| Key                             | Message                                                                    | Recovery action                         | Context                                    |
| ------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| `error.uninstall.no_args`       | Specify at least one tool or use --all. Valid tools: claude, cursor, copilot | Provide one or more tool IDs or use `--all` | `aidd uninstall` called with no arguments  |
| `error.uninstall.not_installed` | {toolId} is not installed                                                  | Check installed tools via `aidd status` | Tool not in manifest                       |
| `error.uninstall.no_manifest`   | No AIDD installation found. Run `aidd init` first.                         | Initialize AIDD                         | No `.aidd` directory or manifest           |

### Status Errors

| Key                               | Message                                                        | Recovery action                                                 | Context                                        |
| --------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| `error.status.no_manifest`        | No AIDD installation found. Run `aidd init` first.             | Initialize AIDD                                                 | No manifest exists                             |
| `error.status.unknown_tool`       | Unknown tool: {toolId}. Valid tools: claude, cursor, copilot   | Use a valid tool ID from the list                               | `--tool` flag references an unrecognized tool  |
| `error.status.tool_not_installed` | {toolId} is not installed                                      | Check installed tools by running `aidd status` without `--tool` | `--tool` flag references valid but not installed tool |

### Clean Errors

| Key                    | Message                          | Recovery action            | Context                        |
| ---------------------- | -------------------------------- | -------------------------- | ------------------------------ |
| `error.clean.no_force` | Use `--force` to confirm removal | Re-run with `--force` flag | `aidd clean` without `--force` |

### Doctor Errors

| Key                               | Message                                                                           | Recovery action   | Context                               |
| --------------------------------- | --------------------------------------------------------------------------------- | ----------------- | ------------------------------------- |
| `error.doctor.manifest_corrupted` | Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize. | Clean and re-init | `.aidd/config.json` is not valid JSON |

### Cache Errors (v3.2+)

| Key                            | Message                                  | Recovery action                | Context                              |
| ------------------------------ | ---------------------------------------- | ------------------------------ | ------------------------------------ |
| `error.cache.version_not_found`| Version {version} is not cached          | Check available versions with `aidd cache` | Specified version not in cache |

### Config Errors

| Key                             | Message                                                                    | Recovery action                  | Context                                         |
| ------------------------------- | -------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------- |
| `error.config.unknown_key`      | Unknown key '{key}'. Valid keys: {validKeys}.                              | Use a valid key from the list    | Unknown key in `get` or `set`                   |
| `error.config.readonly_key`     | '{key}' is read-only. Use the appropriate aidd command to change it.       | Use `install`/`uninstall` etc.   | Attempt to `set tools` or other read-only key   |
| `error.config.no_manifest`      | No AIDD installation found. Run `aidd init` first.                         | Initialize AIDD                  | `config` called with no manifest                |
| `error.config.no_tty`           | Confirmation required. Use --force to skip in non-interactive mode.        | Add `--force`                    | `config set` in non-TTY without `--force`       |

### Config Warnings

| Key                             | Message                                                                                              | Context                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `info.config.dir_found`         | Directory '{value}' found on disk. Updating manifest.                                               | New docsDir already exists on disk           |
| `warn.config.dir_missing`       | Directory '{value}' does not exist on disk.                                                          | New docsDir not found on disk                |
| `warn.config.move_manually`     | Move your docs manually from '{old}' to '{new}' before running other commands.                       | Shown alongside dir_missing warning          |

### Update Errors (v3.1+)

| Key                                  | Message                                                                      | Recovery action                         | Context                                        |
| ------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| `error.update.no_manifest`           | No AIDD installation found. Run `aidd init` first.                           | Initialize AIDD                         | No manifest exists                             |
| `error.update.tool_not_installed`    | {toolId} is not installed                                                    | Check installed tools via `aidd status` | Update requested for non-installed tool        |
| `error.update.dry_run_force_conflict`| --dry-run and --force are mutually exclusive                                  | Use one flag at a time                  | Both --dry-run and --force provided            |

### Restore Errors (v3.1+)

| Key                         | Message                                            | Recovery action | Context            |
| --------------------------- | -------------------------------------------------- | --------------- | ------------------ |
| `error.restore.no_manifest` | No AIDD installation found. Run `aidd init` first. | Initialize AIDD | No manifest exists |

### Sync Errors (v3.1+)

| Key                              | Message                                                                            | Recovery action                                      | Context                                    |
| -------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| `error.sync.no_source`           | --source <tool> is required. Usage: aidd sync --source <tool> [--target <tool>]   | Provide --source flag                                | `aidd sync` called without --source        |
| `error.sync.too_few_tools`       | Sync requires at least 2 installed tools                                           | Install another tool first                           | Fewer than 2 tools installed               |
| `error.sync.same_source_target`  | Source and target must be different tools                                           | Use a different tool for --target                    | --source and --target reference same tool  |
| `error.sync.source_not_installed`| {toolId} is not installed. Installed tools: {installedList}                         | Install the tool first or use an installed tool      | --source references non-installed tool     |
| `error.sync.target_not_installed`| {toolId} is not installed. Installed tools: {installedList}                         | Install the tool first or use an installed tool      | --target references non-installed tool     |

---

## 3. Warning Messages

| Key                                       | Message                                                                                     | Context                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `warn.network.offline_fallback`           | Network unavailable. Using cached framework v{version}.                                     | Network failure but cache exists                              |
| `warn.copilot.name_collision`             | Name collision: {fileName}. Auto-prefixed as {prefixedName}.                                | Copilot flattening produces duplicate names                   |
| `warn.vscode.merge_conflict`              | VS Code config conflict on key "{key}". Keeping existing value.                             | Deep merge into `.vscode/settings.json` finds conflicting key |
| `warn.install.dir_exists_not_in_manifest` | Directory {dir} exists but tool is not in manifest. Files will be overwritten.              | Tool directory on disk but not tracked                        |
| `warn.restore.version_unavailable`        | Version {version} is no longer available. Restoring from latest ({latestVersion}).          | Pinned version not found remotely during restore              |
| `warn.update.version_mismatch`            | Tools installed at different versions: {toolVersionList}. Updating all to v{latestVersion}. | Multiple tools at different framework versions                |
| `warn.init.force_overwrite`               | Overwriting modified file: {filePath}                                                       | `init --force` overwrites a docs file the user had modified   |

---

## 4. Success Messages

| Key                         | Message                                                                      | Context                         |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| `success.init`              | Initialized docs in {docsDir}/ ({fileCount} files)                           | Init completed                  |
| `success.install`           | Installed {toolId} ({fileCount} files)                                       | Single tool install completed   |
| `success.install.multi`     | Installed {toolList} ({totalFileCount} files)                                | Multi-tool install completed    |
| `success.uninstall`         | Uninstalled {toolId} ({fileCount} files removed)                             | Single tool uninstall completed |
| `success.uninstall.multi`   | Uninstalled {toolList} ({totalFileCount} files removed)                      | Multi-tool uninstall completed  |
| `success.clean`             | Cleaned all AIDD files ({fileCount} files removed)                           | Clean --force completed         |
| `success.doctor.healthy`    | Installation is healthy ({fileCount} files tracked across {toolCount} tools) | Doctor finds no issues          |
| `success.status.in_sync`    | All files are in sync                                                        | Status finds no drift           |
| `success.release_pin`       | Using framework release {version}                                            | --release flag resolved         |
| `success.update`            | Updated to v{version} ({added} added, {changed} changed, {removed} removed)  | Update completed                |
| `success.restore`           | Restored {fileCount} files to framework version                              | Restore completed               |
| `success.restore.in_sync`   | All files are in sync. Nothing to restore.                                   | Nothing to restore              |
| `success.update.up_to_date` | Already up to date (v{version})                                              | No newer version available      |
| `success.sync`              | Synced {fileCount} files from {source} to {targets}                          | Sync completed                  |
| `success.cache.cleared`     | Cache cleared ({count} version(s) removed)                                   | `cache --clear` completed       |
| `success.cache.cleared_version` | Cache cleared for v{version}                                             | `cache --clear --version` completed |
| `success.config.set`        | Set {key} = {value}                                                          | `config set` completed          |
| `success.doctor.fixed`      | {fixedCount} issue(s) fixed. Run `aidd doctor` to verify.                   | `doctor --fix` completed        |

---

## 5. Progress Messages

| Key                              | Message                                           | Context                                |
| -------------------------------- | ------------------------------------------------- | -------------------------------------- |
| `progress.framework.downloading` | Downloading framework v{version}...               | Remote framework download in progress  |
| `progress.framework.extracting`  | Extracting framework...                           | Tarball extraction in progress         |
| `progress.framework.cached`      | Using cached framework v{version}                 | Cache hit, no download needed          |
| `progress.init.auto`             | No installation found. Initializing docs first... | Auto-init triggered during install     |
| `progress.install.generating`    | Generating {toolId} distribution...               | File generation in progress for a tool |
| `progress.clean.removing`        | Removing {category} files...                      | File deletion in progress during clean |
| `progress.update.computing`      | Computing changes for {toolId}...                 | Diff computation during update         |
| `progress.update.writing`        | Writing updated files for {toolId}...             | File writes during update              |
| `progress.uninstall.removing`    | Removing {toolId} files...                        | File deletion during uninstall         |
| `progress.doctor.checking`       | Checking installation health...                   | Doctor check in progress               |
| `progress.restore.regenerating`  | Restoring {toolId} files from v{version}...       | File regeneration during restore       |
| `progress.sync.propagating`      | Propagating changes from {sourceToolId}...        | Change propagation during sync         |
| `progress.doctor.fixing`         | Fixing {issueCount} issue(s)...                   | `doctor --fix` remediation in progress |

---

## 6. Empty States

| Key                            | Message                                                       | Context                                 |
| ------------------------------ | ------------------------------------------------------------- | --------------------------------------- |
| `empty.clean.nothing`          | Nothing to clean. No AIDD installation found.                 | `aidd clean` with no manifest           |
| `empty.doctor.not_initialized` | No AIDD installation found. Run `aidd init` first.             | `aidd doctor` with no `.aidd` directory |
| `empty.status.no_tools`        | No tools installed. Run `aidd install <tool>` to get started. | Manifest exists but no tool entries     |
| `empty.cache.nothing`          | No cached framework versions found.                           | `aidd cache` with empty cache directory |

---

## 7. Help Text

### Command Descriptions

| Key                          | Text                                                                | Command                   |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------- |
| `help.program.description`   | Generate AI coding assistant configurations from the AIDD framework | Program-level description |
| `help.init.description`      | Initialize the shared documentation structure                       | `aidd init`               |
| `help.install.description`   | Generate tool-specific distributions from the framework             | `aidd install`            |
| `help.uninstall.description` | Remove a tool's generated configuration files                       | `aidd uninstall`          |
| `help.status.description`    | Show drift between disk files and the manifest                      | `aidd status`             |
| `help.clean.description`     | Remove all AIDD-managed files from the project                      | `aidd clean`              |
| `help.doctor.description`    | Check installation health and detect issues                         | `aidd doctor`             |
| `help.update.description`    | Update installed distributions to the latest framework version      | `aidd update` (v3.1+)     |
| `help.restore.description`   | Restore modified files to their original framework version          | `aidd restore` (v3.1+)    |
| `help.sync.description`      | Propagate changes from one tool to all other installed tools        | `aidd sync` (v3.1+)       |
| `help.cache.description`     | List or clear cached framework versions                             | `aidd cache` (v3.2+)      |
| `help.config.description`    | Get or set project-level CLI settings                               | `aidd config` (v3.2+)     |

### Argument and Option Descriptions

| Key                  | Text                                                   | Used by                               |
| -------------------- | ------------------------------------------------------ | ------------------------------------- |
| `help.arg.tools`     | Tool IDs to operate on (e.g., claude, cursor, copilot) | install, uninstall                    |
| `help.arg.files`     | File paths to restore                                  | restore                               |
| `help.opt.force`     | Skip confirmation or overwrite existing files          | install, clean, update, restore, sync |
| `help.opt.force.install` | Overwrite already-installed tool                    | install                               |
| `help.opt.force.clean`   | Confirm file removal (skip dry-run)                 | clean                                 |
| `help.opt.force.update`  | Overwrite modified files without prompting          | update                                |
| `help.opt.force.restore` | Overwrite user-modified files                       | restore                               |
| `help.opt.force.sync`    | Overwrite conflicts without prompting               | sync                                  |
| `help.opt.version`   | Show version number                                    | Global flag                           |
| `help.opt.verbose`   | Show detailed diagnostic output                        | All commands                          |
| `help.opt.framework` | Path to a local framework directory or tarball         | Commands that resolve framework       |
| `help.opt.repo`      | GitHub repository in owner/repo format                 | Commands that resolve framework       |
| `help.opt.token`     | GitHub authentication token                            | Commands that resolve framework       |
| `help.opt.docs_dir`  | Custom documentation directory name                    | init                                  |
| `help.opt.tool`      | Filter output to a specific tool                       | status                                |
| `help.opt.source`    | Source tool for change propagation                     | sync                                  |
| `help.opt.target`    | Target tool for change propagation                     | sync                                  |
| `help.opt.dry_run`   | Preview changes without writing or deleting any files  | update                                |
| `help.opt.release`   | Specific framework release tag to use (e.g., v3.2.0)  | global flag                           |
| `help.opt.list`      | List cached framework versions                         | cache                                 |
| `help.opt.clear`     | Remove cached framework versions                       | cache                                 |

### Version Output

Format: `aidd/{version} node/{nodeVersion} {platform}`

Example: `aidd/3.2.0 node/20.11.0 darwin-arm64`

---

## 8. Doctor Report Copy

| Key                               | Message                                                                             | Context                                      |
| --------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| `doctor.issue.missing_file`       | Missing: {filePath} (tracked in manifest but not on disk)                           | File in manifest but deleted from disk       |
| `doctor.issue.hash_mismatch`      | Modified: {filePath} (hash does not match manifest)                                 | File content changed since install           |
| `doctor.issue.orphaned_dir`       | Orphaned directory: {dirPath} (not tracked in manifest)                             | Tool directory exists without manifest entry |
| `doctor.issue.manifest_structure` | Manifest has unexpected structure: {detail}                                         | JSON is valid but schema is wrong            |
| `doctor.fix.missing_file`         | Run `aidd install {toolId} --force` to regenerate                                   | Suggested fix for missing files              |
| `doctor.fix.hash_mismatch`        | Intentional change: no action needed. To restore: `aidd restore {filePath}` (v3.1+) | Suggested fix for modified files             |
| `doctor.fix.orphaned_dir`         | Remove the directory manually, or run `aidd install {toolId}` to track it.          | Suggested fix for orphaned directories       |
| `doctor.fix.manifest_structure`   | Run `aidd clean --force` and re-initialize                                          | Suggested fix for structural issues          |

---

## 9. Status Report Copy

| Key                          | Message                                               | Context                               |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `status.header.tool`         | {toolId} (v{version})                                 | Section header for each tool          |
| `status.header.docs`         | docs (v{version})                                     | Section header for docs               |
| `status.category.modified`   | modified                                              | File category label                   |
| `status.category.deleted`    | deleted                                               | File category label                   |
| `status.category.added`      | added                                                 | File category label (untracked files) |
| `status.category.unmodified` | unmodified                                            | File category label                   |
| `status.summary`             | {modified} modified, {deleted} deleted, {added} added | Per-tool summary line                 |
| `status.update_available`    | Update available: v{current} -> v{latest}             | Newer framework version detected      |

---

## 10. Clean Dry-Run Copy

| Key                           | Message                        | Context                  |
| ----------------------------- | ------------------------------ | ------------------------ |
| `clean.preview.header`        | The following will be removed: | Dry-run header           |
| `clean.preview.tool_line`     | {toolId}: {fileCount} files    | Per-tool line in dry-run |
| `clean.preview.docs_line`     | docs: {fileCount} files        | Docs line in dry-run     |
| `clean.preview.manifest_line` | manifest: .aidd/               | Manifest directory line  |
| `clean.preview.total`         | Total: {totalFileCount} files                                                  | Total line in dry-run              |
| `clean.preview.summary`       | Would remove {count} files across {toolCount} tools. Use --force to confirm.   | Aggregate summary for dry-run      |

---

## 11. Output Formatting Conventions

These are not copy strings but structural conventions that ensure consistency across all commands.

| Convention                   | Pattern                 | Example                                   |
| ---------------------------- | ----------------------- | ----------------------------------------- |
| File operation               | `{status} {filePath}` | `+ .claude/agents/alexia.md`            |
| Status indicator: added      | `+`                     | `+ .claude/rules/custom.md`             |
| Status indicator: modified   | `~`                     | `~ .claude/rules/1-command.md`          |
| Status indicator: deleted    | `-`                     | `- .claude/agents/old.md`               |
| Status indicator: unmodified | (not shown)             | Files in sync are not listed              |
| Section separator            | Empty line              | Between tool sections in status/doctor    |
| Error prefix                 | `Error:`                | `Error: Authentication failed.`           |
| Warning prefix               | `Warning:`              | `Warning: Network unavailable.`           |
| Verbose prefix               | `[verbose]`             | `[verbose] Cache hit: v3.2.0`             |
| Indentation                  | 2 spaces                | File lists indented under section headers |
| Status legend                | `Legend: ~ modified  - deleted  + added` | Shown once at end of `aidd status` output when drift exists |
| Verbose tool header          | `[verbose] Tool: {toolId}` | Shown per tool during `aidd install --verbose` |

---

## 12. Interactive Prompts (v3.1+)

### Update Conflict Prompts

| Key                              | Message                                                          | Context                                             |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| `prompt.update.file_modified`    | File modified by you: {filePath}                                 | Shown before each conflict choice during update     |
| `prompt.update.choice`           | Keep your version or overwrite with framework update?            | Prompt question for modified file                   |
| `prompt.update.option_keep`      | Keep mine                                                        | Choice option: preserve user modification           |
| `prompt.update.option_overwrite` | Overwrite with update                                            | Choice option: apply framework version              |
| `prompt.update.option_diff`      | Show diff                                                        | Choice option: display differences before deciding  |
| `prompt.update.summary`          | {kept} kept, {overwritten} overwritten, {skipped} skipped        | Aggregate summary after all conflicts resolved      |

### Sync Conflict Prompts

| Key                              | Message                                                          | Context                                             |
| -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| `prompt.sync.conflict_detected`  | Conflict: {filePath} modified in both {sourceToolId} and {targetToolId} | Shown when same file modified in source and target |
| `prompt.sync.choice`             | Which version to keep?                                           | Prompt question for sync conflict                   |
| `prompt.sync.option_source`      | Keep {sourceToolId} version                                      | Choice option: use source tool version              |
| `prompt.sync.option_target`      | Keep {targetToolId} version                                      | Choice option: use target tool version              |
| `prompt.sync.option_skip`        | Skip this file                                                   | Choice option: leave file unchanged                 |
| `prompt.sync.summary`            | {propagated} propagated, {conflicts} conflicts resolved, {skipped} skipped | Aggregate summary after sync completes        |

---

## 13. Update Dry-Run Preview Copy (v3.1+)

| Key                            | Message                                                                                          | Context                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `update.preview.header`        | The following changes would be applied:                                                          | Dry-run header                            |
| `update.preview.tool_line`     | {toolId}: {added} to add, {changed} to change, {removed} to remove                              | Per-tool line in dry-run                  |
| `update.preview.conflict_note` | {filePath} [conflict — user-modified]                                                            | File flagged as conflicting in dry-run    |
| `update.preview.summary`       | Would apply {total} change(s) across {toolCount} tool(s). Run without --dry-run to apply.       | Aggregate summary for dry-run             |
| `update.preview.no_changes`    | Already up to date ({version}). No changes to apply.                                            | Dry-run with no newer version             |

---

## 14. Cache Output Copy (v3.2+)

| Key                        | Message                                 | Context                              |
| -------------------------- | --------------------------------------- | ------------------------------------ |
| `cache.info.header`        | Cached framework versions:              | Header for `aidd cache` list output  |
| `cache.info.line`          | v{version} ({size})                     | Per-version line in cache list       |

---

## 15. Config Output Copy

| Key                          | Message                                                     | Context                                     |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| `config.list.docsDir`        | docsDir = {value}                                           | `config list` — docs directory line         |
| `config.list.tools`          | tools   = {value}                                           | `config list` — installed tools line        |
| `config.list.tools.none`     | (none)                                                      | No tools installed                          |
| `config.set.noop`            | docsDir is already '{value}'.                               | `config set docsDir` — value unchanged      |
| `config.set.confirm`         | Change docsDir from '{old}' to '{new}'?                     | Interactive confirmation prompt             |
| `config.set.aborted`         | Aborted.                                                    | User declined confirmation                  |
| `config.set.success`         | docsDir updated to '{value}'.                               | `config set docsDir` succeeded              |
