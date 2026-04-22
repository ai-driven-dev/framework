# AIDD CLI

The **AIDD CLI** (`@ai-driven-dev/cli`) distributes the [AI-Driven Development Framework](https://github.com/ai-driven-dev/aidd-framework) consistently across AI coding assistants. It downloads a canonical framework from GitHub, rewrites files to match each tool's conventions, and tracks every installed file in a hash-based manifest to detect drift.

**Supported tools:** Claude Code · Cursor · GitHub Copilot · OpenCode · VS Code (IDE integration)

---

## Prerequisites

| Prerequisite            | Version | Notes                                                   |
| ----------------------- | ------- | ------------------------------------------------------- |
| **Node.js**             | >= 20   | [nodejs.org](https://nodejs.org)                        |
| **tar**                 | —       | Pre-installed on macOS, Linux, WSL and Windows 10 1803+ |
| **gh CLI** _(optional)_ | —       | Can be used as an authentication method via `aidd auth login --gh` |

> **Windows:** works natively on Windows 10 1803+ (PowerShell or cmd) and on WSL.
> If you encounter permission issues with `npm install -g`, use an administrator terminal or WSL.

---

## Installation

Available on [npmjs.org](https://www.npmjs.com/package/@ai-driven-dev/cli).

```bash
# npm (recommended)
npm install -g @ai-driven-dev/cli

# or with pnpm / yarn / bun
pnpm add -g @ai-driven-dev/cli

# Verify
aidd --version
```

> Run `which aidd` to identify the active binary and use the matching package manager (`npm`, `pnpm`, `yarn`, `bun`).

---

## Authentication

The AIDD framework repository requires a GitHub token. Authenticate once with `aidd auth login` — the credential is stored securely in `~/.config/aidd/auth.json` (permissions `600`).

### Method 1 — Personal Access Token (recommended)

Create a [GitHub Personal Access Token](https://github.com/settings/tokens/new) with the **`repo`** and **`read:packages`** scopes, then:

```bash
aidd auth login --token <YOUR_TOKEN> --level user
```

### Method 2 — GitHub CLI

```bash
gh auth login              # authenticate gh CLI once
aidd auth login --gh --level user
```

The token is resolved at runtime via `gh auth token` — no token is stored in the AIDD config.

### Method 3 — Environment variable

```bash
export AIDD_TOKEN=<YOUR_TOKEN>
```

Add to `~/.bashrc`, `~/.zshrc`, or `~/.profile` to make it persistent. Takes precedence over all stored credentials.

### Token resolution order

`AIDD_TOKEN` env → project `.aidd/auth.json` → user `~/.config/aidd/auth.json` → `gh auth token` (only if stored config uses `method: "gh"`)

### Storage levels

| Level     | File                          | Use case                                    |
| --------- | ----------------------------- | ------------------------------------------- |
| `user`    | `~/.config/aidd/auth.json`    | Shared across all projects (default)        |
| `project` | `.aidd/auth.json`             | Per-project credential (add to `.gitignore`) |

### Auth commands

```bash
aidd auth login --token <TOKEN> --level user    # store a PAT
aidd auth login --gh --level user               # use gh CLI token
aidd auth status                                # check current auth (exit 1 if not authenticated)
aidd auth logout                                # remove stored credential
```

---

## Quickstart

```bash
# Authenticate first
aidd auth login --token <YOUR_TOKEN> --level user

# Run interactive setup
aidd setup

# Or manually:
# 1. Install for one or more tools
# aidd install claude cursor

# 2. Verify the installation
aidd status
```

---

## User Flows

### Updating the framework

```bash
aidd status                     # see what changed (drift + available update)
aidd update                     # update all tools and docs to the latest version
aidd update --dry-run           # preview changes without applying them
aidd update --tool claude       # update a single tool only (must already be installed)
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
aidd uninstall ide vscode       # remove VS Code integration only
aidd uninstall ai --all         # remove all AI tools
aidd uninstall --all            # uninstall all tools
```

---

## Commands

| Command                      | Description                                                        | Key options                                  |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `aidd auth`                  | Manage authentication (login, logout, status)                      | `--token`, `--gh`, `--level`                 |
| `aidd setup`                 | Set up or update the project — interactive by default, scriptable with flags | `--release`, `--path`, `--ai`, `--ide`, `--all`, `--docs-dir`, `--from` |
| `aidd install [ai\|ide] <tools...>` | Generate and write tool-specific files (requires existing manifest) | `--all`, `--force`, `--release`, `--path` |
| `aidd uninstall [ai\|ide] <tools...>` | Remove tool files and update manifest                        | `--all`                                      |
| `aidd status [ai\|ide]`      | Show drift between disk and manifest + available update            | `--tool`, `--docs`                           |
| `aidd doctor [ai\|ide]`      | Structural integrity check — exits 1 on errors or warnings         | —                                            |
| `aidd update`                | Apply new framework version                                        | `--force`, `--dry-run`, `--tool`, `--docs`, `--release`, `--path` |
| `aidd restore [files...]`    | Revert modified/deleted files to the pinned framework version      | `--force`, `--tool`, `--docs`, `--release`, `--path` |
| `aidd sync`                  | Propagate local changes from one tool to the others                | `--source` (required), `--target`, `--force` |
| `aidd clean`                 | Remove all AIDD files — dry-run without `--force`                  | `--force`                                    |
| `aidd cache list\|clear`     | List or remove cached framework versions                           | `--all`, `[version]`                         |
| `aidd config list\|get\|set` | Read or update manifest-backed config (`docsDir`, `repo`, `tools`) | `--force`                                    |
| `aidd self-update`           | Update the CLI itself to the latest version                        | `--check`, `--dry-run`, `--force`            |

### `aidd auth`

Manages stored GitHub credentials used to download the framework.

```bash
aidd auth login --token <TOKEN> --level user     # store a PAT at user level
aidd auth login --token <TOKEN> --level project  # store a PAT at project level
aidd auth login --gh --level user                # use gh CLI as token source
aidd auth status                                 # show current auth (exit 1 if not authenticated)
aidd auth logout                                 # remove the active credential
```

Credentials are stored in JSON files with `600` permissions. The `project` level stores in `.aidd/auth.json` — add it to `.gitignore` to avoid committing secrets.

### `aidd setup`

Detects the current project state and runs the appropriate flow (init, adopt, install, or update). Interactive by default; fully scriptable when tool flags are provided.

```bash
aidd setup                                      # interactive guided setup
aidd setup --release v3.4.0                     # pin a specific framework version
aidd setup --path ./local                       # use a local framework copy
aidd setup --all                                # non-interactive: init + install all tools (AI + IDE)
aidd setup --ai claude,cursor                   # non-interactive: init + install specific AI tools
aidd setup --ide vscode                         # non-interactive: init + install specific IDE tools
aidd setup --ai claude,cursor --ide vscode      # mix AI and IDE tools
aidd setup --ai claude --from v3.2.0            # non-interactive adopt (existing tool files)
aidd setup --docs-dir my_docs                   # custom documentation directory
```

Passing `--all`, `--ai`, or `--ide` disables interactive prompts — values with defaults (docs dir, repo, release) are resolved automatically. For `adopt` state, `--from` is required.

### `aidd install`

Generates and writes tool-specific distribution files (agents, commands, rules, skills, config).

> Requires an existing AIDD project (manifest). For first-time setup, use `aidd setup` instead.

```bash
aidd install claude
aidd install claude cursor copilot opencode
aidd install vscode                          # IDE integration only
aidd install ai claude cursor               # scope to AI tools only
aidd install ide vscode                     # scope to IDE tools only
aidd install --all                          # all supported tools
aidd install ai --all                       # all AI tools
aidd install ide --all                      # all IDE tools
aidd install claude --force                 # overwrite existing files
aidd install claude --release v3.4.0       # pin a specific framework version
```

The optional `ai` or `ide` prefix scopes the operation and validates that the listed tools belong to that category.

### `aidd uninstall`

Removes a tool's generated files and updates the manifest.

```bash
aidd uninstall cursor
aidd uninstall ide vscode                   # scope to IDE tools
aidd uninstall ai --all                     # remove all AI tools
aidd uninstall --all                        # remove all installed tools
```

### `aidd status`

Compares files on disk with the manifest. Shows drift and available framework updates.

```bash
aidd status                     # all tools + docs
aidd status ai                  # AI tools only (no docs)
aidd status ide                 # IDE tools only (no docs)
aidd status --docs              # docs only
```

Legend: `~` modified · `-` deleted · `+` untracked (on disk, not in manifest)

### `aidd doctor`

Checks structural integrity. Exits 1 if errors or warnings are found; exits 0 with a warning message if only the auth credential is missing (non-blocking in CI).

```bash
aidd doctor                     # check all tools + docs
aidd doctor ai                  # AI tools only
aidd doctor ide                 # IDE tools only
```

Detects: missing or corrupted manifest, orphaned tool directories, broken `@path` includes and markdown links in tracked files.

> Drift (modified/deleted files) is not a structural issue — use `aidd status` for that.

### `aidd update`

Downloads the latest framework version and applies changes. See [Updating the framework](#updating-the-framework) for examples.

> `--tool <name>` only updates tools already present in the manifest. Use `aidd install <tool>` to add a new tool.

### `aidd restore`

Reverts modified or deleted files to the framework version pinned in the manifest. See [Restoring modified files](#restoring-modified-files) for examples.

### `aidd sync`

Propagates local modifications from one tool's files to the others via reverse + forward content rewriting. See [Syncing changes across tools](#syncing-changes-across-tools) for examples.

### `aidd clean`

Removes all AIDD-generated files and the manifest.

```bash
aidd clean                      # dry-run: shows what will be removed
aidd clean --force              # actual removal
```

### `aidd self-update`

Updates the CLI itself to the latest published version.

```bash
aidd self-update                # install latest version
aidd self-update --check        # check availability without installing
aidd self-update --dry-run      # preview without installing
aidd self-update --force        # reinstall even if already up to date
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

## Options

### Global (all commands)

```bash
aidd update --verbose           # detailed logs
aidd update --repo owner/repo   # alternative framework repository
```

### Framework source (setup, install, update, restore)

```bash
aidd setup --release v3.4.0             # pin a specific framework version (first-time)
aidd update --release v3.4.0            # pin a specific framework version (existing project)
aidd update --path ./local              # local framework path (dev/testing)
```

**Environment variables:**

| Variable       | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `AIDD_TOKEN`   | GitHub token with `repo` and `read:packages` scopes — takes precedence over stored credentials |
| `AIDD_REPO`    | Custom framework repository (`owner/repo`)                              |
| `AIDD_VERBOSE` | Verbose mode (`true`/`false`)                                           |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

Code contributions are open to certified **Obsidian+** members.

---

## License

Private repository — all AIDD team members.

---

← [Back to aidd-framework](https://github.com/ai-driven-dev/aidd-framework)
