# AIDD CLI

The **AIDD CLI** (`@ai-driven-dev/cli`) distributes the [AI-Driven Development Framework](https://github.com/ai-driven-dev/aidd-framework) consistently across AI coding assistants. It downloads a canonical framework from GitHub, rewrites files to match each tool's conventions, and tracks every installed file in a hash-based manifest to detect drift.

**Supported tools:** Claude Code · Cursor · GitHub Copilot

---

## Prerequisites

| Prerequisite            | Version | Notes                                                   |
| ----------------------- | ------- | ------------------------------------------------------- |
| **Node.js**             | >= 24   | [nodejs.org](https://nodejs.org)                        |
| **tar**                 | —       | Pre-installed on macOS, Linux, WSL and Windows 10 1803+ |
| **gh CLI** _(optional)_ | —       | Replaces the AIDD framework token if authenticated      |

> **Windows:** works natively on Windows 10 1803+ (PowerShell or cmd) and on WSL.
> If you encounter permission issues with `npm install -g`, use an administrator terminal or WSL.

---

## Authentication

Two tokens are required with different responsibilities.

### Token 1 — npm registry (one-time setup)

Required **once** to install the CLI from GitHub Packages. Create a [GitHub Personal Access Token](https://github.com/settings/tokens/new) with the **`read:packages`** scope, then add it to your `~/.npmrc`:

**macOS / Linux / WSL:**

```bash
echo "@ai-driven-dev:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=<YOUR_NPM_TOKEN>" >> ~/.npmrc
```

**Windows (PowerShell):**

```powershell
npm config set @ai-driven-dev:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken <YOUR_NPM_TOKEN>
```

### Token 2 — AIDD framework (runtime)

Required each time the CLI downloads the framework (`init`, `install`, `update`, `restore`, `adopt`). The framework repository is private — this token must have the **`repo`** scope.

**Option 1 — Environment variable (recommended)**

```bash
export AIDD_TOKEN=<YOUR_FRAMEWORK_TOKEN>
```

Add to `~/.bashrc`, `~/.zshrc`, or `~/.profile` to make it persistent.

**Option 2 — gh CLI**

```bash
gh auth login   # once only — token is resolved automatically afterwards
```

**Option 3 — Inline flag**

```bash
aidd install claude --token <YOUR_FRAMEWORK_TOKEN>
```

Token resolution order: `--token` flag > `AIDD_TOKEN` env > `gh auth token`.

---

## Installation

```bash
npm install -g @ai-driven-dev/cli

# Verify
aidd --version
```

---

## Quickstart

```bash
# 1. Initialize the docs structure and the manifest
aidd init

# 2. Install for one or more tools
aidd install claude cursor

# 3. Verify the installation
aidd status
```

> `aidd install` requires a prior `aidd init`. It will abort with a clear error if no manifest exists.

---

## User Flows

### Migrating from a manual install

If you already have AIDD files installed manually (no `.aidd/manifest.json`), use `adopt` to bootstrap a manifest from what's on disk — no download, no overwrite.

```bash
aidd adopt --tools claude --release v3.4.0

# Multiple tools
aidd adopt --tools claude cursor --release v3.4.0
```

`--release` is required: it pins the version the manifest will record. After adoption, run `aidd status` to see drift and `aidd update` to align with the latest framework version.

### Updating the framework

```bash
aidd status                     # see what changed (drift + available update)
aidd update                     # update all tools and docs to the latest version
aidd update --dry-run           # preview changes without applying them
aidd update --tool claude       # update a single tool only
aidd update --docs              # update docs only
aidd update --force             # overwrite conflicts without prompting
```

### Restoring modified files

```bash
aidd status                          # identify modified (~) files
aidd restore claude                  # restore all modified/deleted files for a tool
aidd restore --docs                  # restore docs only
aidd restore claude rules/naming.md  # restore a specific file
aidd restore claude --force          # skip confirmation prompts (CI-safe)
```

Restore uses the version pinned in the manifest. It does not touch untracked files.

### Syncing changes across tools

```bash
aidd sync --source claude                  # propagate claude changes to all other tools
aidd sync --source claude --target cursor  # propagate to a specific tool only
aidd sync --source claude --force          # overwrite conflicting target files
```

Excluded from sync: memory bank files, MCP configs, VS Code settings, docs.

### Uninstalling a tool

```bash
aidd uninstall cursor           # remove cursor files and clean up the manifest
aidd uninstall --all            # uninstall all tools
```

---

## Commands

| Command                      | Description                                                        | Key options                                  |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `aidd init`                  | Create `aidd_docs/` structure and manifest                         | `--force`, `--docs-dir`, `--repo`            |
| `aidd install <tools...>`    | Generate and write tool-specific files                             | `--all`, `--force`                           |
| `aidd uninstall <tools...>`  | Remove tool files and update manifest                              | `--all`                                      |
| `aidd adopt`                 | Bootstrap manifest for existing manual installations               | `--tools` (required) + global `--release`    |
| `aidd status`                | Show drift between disk and manifest + available update            | `--tool`, `--docs`                           |
| `aidd doctor`                | Structural integrity check — exits 1 on issues (CI-safe)           | —                                            |
| `aidd update`                | Apply new framework version                                        | `--force`, `--dry-run`, `--tool`, `--docs`   |
| `aidd restore [files...]`    | Revert modified/deleted files to the pinned framework version      | `--force`, `--tool`, `--docs`                |
| `aidd sync`                  | Propagate local changes from one tool to the others                | `--source` (required), `--target`, `--force` |
| `aidd clean`                 | Remove all AIDD files — dry-run without `--force`                  | `--force`                                    |
| `aidd cache list\|clear`     | List or remove cached framework versions                           | `--all`, `[version]`                         |
| `aidd config list\|get\|set` | Read or update manifest-backed config (`docsDir`, `repo`, `tools`) | `--force`                                    |

### `aidd init`

Creates the `aidd_docs/` structure and the `.aidd/manifest.json` manifest. Must be run before `install`.

```bash
aidd init                       # fresh initialization
aidd init --docs-dir my_docs    # custom docs directory
aidd init --force               # re-copy doc templates into existing docs dir (preserves tool files)
```

> On a project with existing AIDD signals but no manifest, `init` will abort and suggest `aidd adopt` instead.

### `aidd install`

Generates and writes tool-specific distribution files (agents, commands, rules, skills, config).

```bash
aidd install claude
aidd install claude cursor copilot
aidd install --all              # all supported tools
aidd install claude --force     # overwrite existing files
```

### `aidd uninstall`

Removes a tool's generated files and updates the manifest.

```bash
aidd uninstall cursor
aidd uninstall --all
```

### `aidd status`

Compares files on disk with the manifest. Shows drift and available framework updates.

```bash
aidd status                     # all tools + docs
aidd status --tool claude       # filter to one tool
aidd status --docs              # docs only
```

Legend: `~` modified · `-` deleted · `+` untracked (on disk, not in manifest)

### `aidd doctor`

Checks structural integrity. Exits with code 1 if issues are found (CI-compatible).

```bash
aidd doctor
```

Detects: missing or corrupted manifest, orphaned tool directories, broken `@path` includes and markdown links in tracked files.

> Drift (modified/deleted files) is not a structural issue — use `aidd status` for that.

### `aidd update`

Downloads the latest framework version and applies changes. See [Updating the framework](#updating-the-framework) for examples.

### `aidd restore`

Reverts modified or deleted files to the framework version pinned in the manifest. See [Restoring modified files](#restoring-modified-files) for examples.

### `aidd sync`

Propagates local modifications from one tool's files to the others via reverse + forward content rewriting. See [Syncing changes across tools](#syncing-changes-across-tools) for examples.

### `aidd adopt`

Bootstraps a manifest for projects with existing manually installed AIDD files. See [Migrating from a manual install](#migrating-from-a-manual-install) for examples.

### `aidd clean`

Removes all AIDD-generated files and the manifest.

```bash
aidd clean                      # dry-run: shows what will be removed
aidd clean --force              # actual removal
```

### `aidd cache`

Manages locally cached framework versions (stored in `.aidd/cache/`).

```bash
aidd cache list                 # list cached versions with path and size
aidd cache clear                # remove all cached versions
aidd cache clear v3.4.0         # remove a specific version
```

### `aidd config`

Reads or updates project-level configuration backed by the manifest.

```bash
aidd config list                # show all config values
aidd config get repo            # read a value (docsDir, repo, tools)
aidd config set repo owner/repo # update repo (writable: docsDir, repo)
```

`tools` is read-only — use `install`/`uninstall` to change it.

---

## Global Options

```bash
aidd install claude --verbose            # detailed logs
aidd install claude --token <token>      # explicit AIDD framework token
aidd install claude --repo owner/repo    # alternative framework repository
aidd install claude --framework ./local  # local framework path (dev/testing)
aidd install claude --release v3.4.0    # pin a specific framework version
```

**Environment variables:**

| Variable       | Description                                |
| -------------- | ------------------------------------------ |
| `AIDD_TOKEN`   | AIDD framework token (`repo` scope)        |
| `AIDD_REPO`    | Custom framework repository (`owner/repo`) |
| `AIDD_VERBOSE` | Verbose mode (`true`/`false`)              |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

Code contributions are open to certified **Obsidian+** members.

---

## License

Private repository — all AIDD team members.

---

← [Back to aidd-framework](https://github.com/ai-driven-dev/aidd-framework)
