# 📦 AIDD CLI v3.0

The **AIDD CLI** (`@ai-driven-dev/aidd-cli`) is the TypeScript installer for the AI-Driven Development framework. It distributes the AIDD framework consistently across multiple AI assistants (Claude Code, Cursor, GitHub Copilot), generating tool-specific files and tracking each installation via an MD5-hash-based manifest.

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Using the AIDD token](#using-the-aidd-token)
- [Commands](#commands)
  - [`aidd init`](#aidd-init)
  - [First use](#first-use)
  - [`aidd status`](#aidd-status)
  - [`aidd doctor`](#aidd-doctor)
  - [`aidd uninstall`](#aidd-uninstall)
  - [`aidd clean`](#aidd-clean)
  - [Global options](#global-options)
- [Architecture](#architecture)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

| Command                     | Description                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `aidd init [--force]`       | Initializes the `aidd_docs/` structure and the manifest (`--force` copies doc templates without clean)       |
| `aidd install <tools...>`   | Generates tool-specific files (`--all`, `--force`)                                                           |
| `aidd uninstall <tools...>` | Cleanly removes a tool's files (`--all`)                                                                     |
| `aidd status [--tool]`      | Diffs files vs manifest: `~` modified, `-` deleted, `+` added                                               |
| `aidd doctor`               | Structural integrity check: manifest, orphan directories, broken references                                  |
| `aidd clean [--force]`      | Removes all AIDD traces (dry-run without `--force`)                                                          |
| `aidd update`               | Updates distributions to the latest framework version (v3.1+)                                               |
| `aidd restore <tool>`       | Restores modified files to their original version (v3.1+)                                                    |
| `aidd sync --source <tool>` | Propagates changes from one tool to the others (v3.1+)                                                       |
| `aidd cache`                | Lists or removes cached framework versions (v3.2+)                                                           |
| `aidd config get/set`       | Reads or updates manifest config: `docsDir` (w), `repo` (w), `tools` (r) (v3.2+)                            |

**Global options:** `--verbose`, `--token`, `--repo`, `--framework`, `--release`

**Supported tools:** Claude Code · Cursor · GitHub Copilot

## Prerequisites

| Prerequisite             | Version | Notes                                                                                  |
| ------------------------ | ------- | -------------------------------------------------------------------------------------- |
| **Node.js**              | >= 24   | [nodejs.org](https://nodejs.org) — LTS since October 2024                              |
| **AIDD Token**           | —       | Required to download the framework                                                     |
| **tar**                  | —       | Pre-installed on macOS, Linux, WSL and Windows 10 1803+                                |
| **gh CLI** _(optional)_  | —       | If installed and authenticated (`gh auth login`), the token is resolved automatically  |

> **Windows:** works natively on Windows 10 1803+ (PowerShell or cmd) and on WSL. `tar.exe` is provided by Windows. If you encounter permission issues with `npm install -g`, use an administrator terminal or WSL.

## Installation

The package is hosted on GitHub Packages. It requires a [GitHub token](https://github.com/settings/tokens/new) with the **`read:packages`** scope.

**macOS / Linux / WSL:**

```bash
# Configure the GitHub Packages registry (token with read:packages scope)
echo "@ai-driven-dev:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=<YOUR_TOKEN>" >> ~/.npmrc

# Install globally
npm install -g @ai-driven-dev/aidd-cli

# Verify installation
aidd --version
```

**Windows (PowerShell):**

```powershell
# GitHub token with read:packages scope required
npm config set @ai-driven-dev:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken <YOUR_TOKEN>

npm install -g @ai-driven-dev/cli
aidd --version
```

## Using the AIDD token

The token is required each time the framework is downloaded (`init` and `install` commands). Three ways to provide it:

**Option 1 — Environment variable (recommended)**

```bash
export AIDD_TOKEN=<YOUR_TOKEN>
aidd install claude
```

Add to `~/.bashrc`, `~/.zshrc` or `~/.profile` to make it persistent.

**Option 2 — gh CLI (if already installed)**

```bash
gh auth login   # once only
aidd install claude   # token is resolved automatically
```

**Option 3 — Inline flag**

```bash
aidd install claude --token <YOUR_TOKEN>
```

## Commands

### `aidd init`

Initializes the `aidd_docs/` structure and the `.aidd/manifest.json` manifest.

```bash
aidd init                        # first initialization
aidd init --docs-dir my_docs    # custom docs directory
aidd init --force                # copies doc templates without clean (preserves installed tools)
```

### First use

```bash
# 1. Initialize the docs structure (aidd_docs/ + manifest)
aidd init

# 2. Install for one or more tools
aidd install claude cursor

# Or install everything at once
aidd install --all
```

> `aidd install` requires a prior `aidd init`. It will abort with a clear error if no manifest exists.

### `aidd status`

Compares files on disk with the manifest and displays differences per tool.

```bash
aidd status                      # all tools
aidd status --tool claude        # filter by tool
```

Legend: `~` modified · `-` deleted · `+` added (present on disk, not tracked)

### `aidd doctor`

Checks the structural integrity of the installation. Returns exit code 1 on issues (CI-compatible).

```bash
aidd doctor
```

Detects:

- Missing or corrupted manifest (invalid JSON)
- Tool directories present on disk but not tracked in the manifest (orphans)
- Broken references in tracked `.md`/`.mdc` files (`@path` for Claude/Cursor, markdown links for Copilot)

> Locally deleted or modified files are drift, not structural issues — use `aidd status` to see them.

### `aidd uninstall`

Removes a tool's files and removes its entries from the manifest.

```bash
aidd uninstall cursor
aidd uninstall --all             # all installed tools
```

### `aidd clean`

Removes all AIDD traces from the project (generated files + manifest).

```bash
aidd clean                       # dry-run: shows what will be removed
aidd clean --force               # actual removal
```

### Global options

```bash
aidd install claude --verbose            # detailed logs
aidd install claude --token <token>      # explicit token
aidd install claude --repo owner/repo    # alternative framework
aidd install claude --framework ./local  # local framework (dev/test)
aidd install claude --release v3.2.0    # specific framework version
```

**Environment variables:**

| Variable       | Description                                  |
| -------------- | -------------------------------------------- |
| `AIDD_TOKEN`   | GitHub Packages authentication token         |
| `AIDD_REPO`    | Custom framework repository (`owner/repo`)   |
| `AIDD_VERBOSE` | Verbose mode (`true`/`false`)                |

## Architecture

3-layer architecture (Domain → Application → Infrastructure):

```
src/
├── cli.ts                    # Commander entry point
├── domain/                   # Business models + ports + tool-configs
├── application/              # Use cases + commander commands
└── infrastructure/           # Adapters + HTTP + cache + auth
```

For more details, see [aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md).

## Development

```bash
# Additional dev prerequisite: pnpm >= 9

# Install dependencies
pnpm install

# Build
pnpm build

# Tests (build + vitest)
pnpm test

# Typecheck + lint
pnpm typecheck && pnpm lint

# Local CLI test
pnpm run install:local
aidd --version
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

Code contributions are open to certified **Obsidian+** members.

## License

Private repository for all AIDD team members.

---

← [Back to main repo](https://github.com/ai-driven-dev/aidd)
