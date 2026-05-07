# AIDD CLI

The **AIDD CLI** (`@ai-driven-dev/cli`) installs AI tool runtime configs, IDE integrations, and plugins from the [AIDD marketplace](https://github.com/ai-driven-dev/aidd-framework) across AI coding assistants. Runtime configs and memory stubs are bundled in the CLI binary. Plugins are fetched from the marketplace on demand. Every installed file is hash-tracked in a manifest for drift detection.

**Supported tools:** Claude Code · Cursor · GitHub Copilot · OpenCode · Codex · VS Code (IDE integration)

---

## Prerequisites

| Prerequisite            | Version | Notes                                                   |
| ----------------------- | ------- | ------------------------------------------------------- |
| **Node.js**             | >= 24   | [nodejs.org](https://nodejs.org)                        |
| **git**                 | —       | Required for marketplace plugin fetching                |
| **gh CLI** _(optional)_ | —       | Can be used as an authentication method via `aidd auth login --gh` |

> **Windows:** works natively on Windows 10 1803+ (PowerShell or cmd) and on WSL.
> If you encounter permission issues with `npm install -g`, use an administrator terminal or WSL.

---

## Installation

Available on [npmjs.org](https://www.npmjs.com/package/@ai-driven-dev/cli).

```bash
# npm (recommended)
npm install -g @ai-driven-dev/cli@latest

# or with pnpm / yarn / bun
pnpm add -g @ai-driven-dev/cli@latest

# Verify
aidd --version
```

> Run `which aidd` to identify the active binary and use the matching package manager (`npm`, `pnpm`, `yarn`, `bun`).

---

## Authentication

Authentication is **not required** for the default public marketplace (`github.com/ai-driven-dev/aidd-framework`). Authentication is only needed for private marketplaces.

To authenticate for a private marketplace:

### Method 1 — Personal Access Token (recommended)

```bash
aidd auth login --token <YOUR_TOKEN> --level user
```

### Method 2 — GitHub CLI

```bash
gh auth login
aidd auth login --gh --level user
```

### Method 3 — Environment variable

```bash
export AIDD_TOKEN=<YOUR_TOKEN>
```

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
# 1. Interactive setup: init manifest + register default marketplace + install runtime config
aidd setup

# 2. Non-interactive scriptable setup (CI / onboarding scripts)
aidd setup --source remote --ai claude --ide vscode --recommended-plugins --yes

# 3. Install a plugin from the marketplace
aidd plugin install aidd-context

# 4. Check installation status
aidd ai status
```

### Brownfield (existing project)

```bash
# Migrate obsolete manifest entries from previous CLI versions
aidd migrate
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

### Managing plugins

```bash
# Register a marketplace and install plugins
aidd marketplace add acme owner/aidd-plugins
aidd plugin pick                         # interactive browse + install

# One-shot non-interactive install
aidd plugin install my-plugin --yes

# Keep plugins up to date
aidd plugin update

# Check for stale catalogs or upstream-removed plugins
aidd marketplace check
```

### Uninstalling a tool

```bash
aidd ai uninstall cursor        # remove cursor files and clean up the manifest
aidd ide uninstall vscode       # remove VS Code integration only
aidd ai uninstall --all         # remove all AI tools
```

---

## Commands

| Command                         | Description                                                                          | Key options                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `aidd auth`                     | Manage authentication (login, logout, status)                                        | `--token`, `--gh`, `--level`                                      |
| `aidd setup`                    | Bootstrap a project: init manifest + register marketplace + install runtime config   | `--source`, `--ai`, `--ide`, `--all`, `--recommended-plugins`, `--yes` |
| `aidd ai install <tool>`        | Install an AI tool runtime configuration from bundled assets                         | `--force`                                                         |
| `aidd ai uninstall <tool>`      | Remove an AI tool's generated configuration files                                    | —                                                                 |
| `aidd ai list`                  | List installed AI tools                                                              | —                                                                 |
| `aidd ai status`                | Show drift for AI tools                                                              | —                                                                 |
| `aidd ai update [tool]`         | Re-install AI tool configs from bundled CLI assets                                   | `--force`                                                         |
| `aidd ai sync`                  | Propagate local modifications from one AI tool to others                             | `--source` (required), `--target`, `--force`, `--no-plugins`      |
| `aidd ai restore [files...]`    | Restore AI tool tracked files to their installed version                             | `--force`, `--tool`                                               |
| `aidd ai doctor`                | Check AI tool installation health and detect issues                                  | —                                                                 |
| `aidd ide install <tool>`       | Install an IDE integration from bundled assets                                       | `--force`                                                         |
| `aidd ide uninstall <tool>`     | Remove an IDE integration from the manifest                                          | —                                                                 |
| `aidd ide list`                 | List installed IDE tools                                                             | —                                                                 |
| `aidd ide status`               | Show drift for IDE tools                                                             | —                                                                 |
| `aidd ide update [tool]`        | Re-install IDE tool configs from bundled CLI assets                                  | `--force`                                                         |
| `aidd ide doctor`               | Check IDE tool installation health and detect issues                                 | —                                                                 |
| `aidd migrate`                  | Detect and strip obsolete manifest entries from previous CLI versions                | `--dry-run`, `--non-interactive`                                  |
| `aidd status`                   | Show drift across all tools (AI + IDE)                                               | —                                                                 |
| `aidd doctor`                   | Structural integrity check — exits 1 on errors or warnings                           | —                                                                 |
| `aidd restore [files...]`       | Revert modified/deleted files to the manifest-pinned version                         | `--force`, `--tool`                                               |
| `aidd sync`                     | Propagate local changes from one tool to the others                                  | `--source` (required), `--target`, `--force`                      |
| `aidd plugin`                   | Manage plugins for AI tools                                                          | `add`, `remove`, `list`, `install`, `search`, `pick`, `update`    |
| `aidd marketplace`              | Manage plugin marketplaces                                                           | `add`, `list`, `remove`, `refresh`, `browse`, `check`, `cache`    |
| `aidd clean`                    | Remove all AIDD files — dry-run without `--force`                                    | `--force`                                                         |
| `aidd self-update`              | Update the CLI itself to the latest version                                          | `--check`, `--dry-run`, `--force`                                 |

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

Bootstraps a new project: initializes the manifest, registers the default marketplace, and writes the runtime config for the selected tools. Interactive by default; scriptable with flags.

```bash
aidd setup                                              # interactive guided setup
aidd setup --source remote --ai claude --yes            # non-interactive: remote marketplace, claude
aidd setup --source local --path /path/to/framework \
  --ai claude --ide vscode --recommended-plugins --yes  # local framework source
aidd setup --all --yes                                  # all tools, no prompts
aidd setup --ai claude,cursor --ide vscode              # mix AI and IDE tools
```

`--source remote|local` selects the marketplace source. `--yes` accepts all defaults. Passing `--all`, `--ai`, `--ide`, or `--source` disables interactive prompts.

### `aidd ai`

Manages AI tools (install, uninstall, list, status, update, sync, restore, doctor).

```bash
aidd ai install claude                      # install Claude Code runtime config
aidd ai install cursor --force              # overwrite existing files
aidd ai uninstall claude                    # remove Claude Code files
aidd ai list                                # list installed AI tools
aidd ai status                             # show drift for all AI tools
aidd ai update                             # re-install all AI tool configs
aidd ai update claude                      # re-install a specific AI tool
aidd ai sync --source claude               # propagate claude changes to all other AI tools
aidd ai sync --source claude --target cursor --force  # to a specific target
aidd ai restore --tool claude              # restore modified Claude files
aidd ai doctor                             # check AI tool installation health
```

### `aidd ide`

Manages IDE integrations (install, uninstall, list, status, update, doctor).

```bash
aidd ide install vscode                    # install VS Code integration
aidd ide uninstall vscode                  # remove VS Code integration
aidd ide list                              # list installed IDE tools
aidd ide status                            # show drift for IDE tools
aidd ide update                            # re-install all IDE tool configs
aidd ide doctor                            # check IDE tool installation health
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

Re-applies bundled configs and fetches updated plugin content. See [Updating the framework](#updating-the-framework) for examples.

> `--tool <name>` only updates tools already present in the manifest. Use `aidd install ai <tool>` to add a new tool.

### `aidd restore`

Reverts modified or deleted files to the version pinned in the manifest. See [Restoring modified files](#restoring-modified-files) for examples.

### `aidd sync`

Propagates local modifications from one tool's files to the others via reverse + forward content rewriting. See [Syncing changes across tools](#syncing-changes-across-tools) for examples.

### `aidd plugin`

Manages plugins for AI tools. Plugins extend the framework with additional agents, rules, hooks, and commands distributed independently of the core framework.

```bash
aidd plugin add owner/repo                  # add a local/remote plugin to all installed tools
aidd plugin add owner/repo --tool claude    # add to a specific tool only
aidd plugin install my-plugin               # install a plugin from a registered marketplace
aidd plugin install my-plugin@1.2.0         # pin to a specific version
aidd plugin install my-plugin --from acme   # resolve from a specific marketplace
aidd plugin install my-plugin --yes         # auto-resolve prompts (CI mode)
aidd plugin list                            # list installed plugins (all tools)
aidd plugin list --tool claude              # list for a specific tool
aidd plugin search hooks                    # search marketplaces by keyword
aidd plugin search hooks --recommended      # show only recommended results
aidd plugin search hooks --marketplace acme # limit search to one marketplace
aidd plugin pick                            # interactively browse and install from a marketplace
aidd plugin update                          # update all installed plugins
aidd plugin update my-plugin               # update a specific plugin
aidd plugin remove my-plugin               # remove a plugin from all tools
aidd plugin remove my-plugin --tool claude  # remove from a specific tool
```

### `aidd marketplace`

Registers and manages plugin marketplaces — sources that publish plugin catalogs.

```bash
aidd marketplace add acme owner/aidd-plugins    # register a marketplace (project scope)
aidd marketplace add acme owner/aidd-plugins --user  # register at user scope
aidd marketplace add acme owner/aidd-plugins --yes   # skip trust + cleanup prompts
aidd marketplace add acme owner/aidd-plugins --overwrite  # replace existing entry
aidd marketplace list                           # list registered marketplaces
aidd marketplace browse acme                    # list plugins in a marketplace
aidd marketplace browse acme --use-cache        # use cached catalog if fetch fails
aidd marketplace refresh                        # refresh all marketplace catalogs
aidd marketplace refresh acme                   # refresh a specific marketplace
aidd marketplace remove acme                    # remove a registered marketplace
aidd marketplace remove acme --yes              # skip orphan-cleanup prompt
aidd marketplace check                          # report stale marketplaces and removed plugins
aidd marketplace cache list                     # list cached marketplace catalogs with size and last fetch time
aidd marketplace cache clear                    # clear all marketplace cache entries
aidd marketplace cache clear acme              # clear cache for a specific marketplace
```

Marketplace sources accept a GitHub shorthand (`owner/repo`) or a full path to a local catalog file. Use `--token` on `marketplace add` or `plugin install` when the source requires authentication.

### `aidd migrate`

Detects and strips obsolete manifest entries left over from previous CLI versions (bundled `scripts` section, top-level `plugins` section, plugins without a marketplace source). Backs up the manifest before any write. Idempotent — safe to run multiple times.

```bash
aidd migrate                    # interactive migration
aidd migrate --dry-run          # show plan without applying changes
aidd migrate --non-interactive  # apply without confirmation prompts
```

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

---

## Options

### Global (all commands)

```bash
aidd update --verbose           # detailed logs
```

**Environment variables:**

| Variable       | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `AIDD_TOKEN`   | GitHub token — takes precedence over stored credentials (needed for private marketplaces only) |
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
