# AIDD CLI — User Stories

> Complete backlog for the AIDD CLI v3.0 and v3.1+ project, organized by epics.
> North Star Metric: 70% community adoption within 6 months.
> Velocity: 20 pts/sprint — Sprint: 2 weeks.

---

# Epic: Framework Resolution

> Allow the CLI to download, extract, cache and load the canonical framework from a remote source, a local tarball, or a local directory.

## Scope Tier

**MVP**

## Justification NSM

Without framework resolution, no command can work. This is the technical foundation on which init, install and all subsequent commands depend. Adoption = 0% without this building block.

## User Stories

| ID     | User Story                                                                                                                               | Points | Priority | Status |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-001 | As a developer, I want the CLI to download the latest framework from GitHub so that I always work with the most recent community content | 5      | Must     | ⬜     |
| US-002 | As a developer, I want to point the CLI to a local directory or tarball so that I can work offline or test unreleased framework versions | 3      | Must     | ⬜     |
| US-003 | As a developer, I want the CLI to cache downloaded frameworks so that repeated commands do not trigger redundant downloads               | 3      | Must     | ⬜     |
| US-004 | As a developer, I want the CLI to fall back to a cached version when the network is unavailable so that I can keep working offline       | 2      | Must     | ⬜     |
| US-005 | As a developer, I want the CLI to auto-detect my GitHub token so that I do not have to pass credentials manually every time              | 2      | Should   | ⬜     |
| US-026 | As a developer, I want to specify a custom framework repository so that I can use a fork or private variant of the framework             | 2      | Should   | ⬜     |

**Legend** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Total Estimate

| Metric              | Value                                    |
| ------------------- | ---------------------------------------- |
| **Stories**         | 6                                        |
| **Total points**    | 17                                       |
| **Estimated sprints** | 1 (estimated velocity: 20 pts/sprint)  |

## Acceptance Criteria (epic level)

- [ ] The CLI resolves a framework from remote, tarball, and local directory sources
- [ ] Caching prevents redundant downloads across sessions
- [ ] Offline fallback works when a cache exists
- [ ] Auth token is never written to disk or logged

## Dependencies

| Dependency                       | Type      | Blocking?                   |
| -------------------------------- | --------- | --------------------------- |
| GitHub Releases API availability | External  | No (local fallback exists)  |
| framework.json descriptor schema | Technical | Yes                         |

## Associated Spikes

| Spike                            | Objective                                                              | Time-box | Status |
| -------------------------------- | ---------------------------------------------------------------------- | -------- | ------ |
| GitHub tarball nesting detection | Validate single-directory nesting pattern across different GitHub orgs | 1 day    | ⬜     |

---

## Validation

- [x] NSM justification documented
- [x] All stories follow INVEST
- [x] Gherkin acceptance criteria for each story
- [x] Total estimate < 13 points per story
- [x] Dependencies identified and mitigation plan in place

---

## US-001: "Download latest framework from remote"

**As a** developer
**I want** the CLI to download the latest framework from GitHub
**So that** I always work with the most recent community content

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 5 pts      | Must     | Framework Resolution |

### Acceptance Criteria

```gherkin
Scenario: Remote framework download and caching
  Given no cached framework exists for the latest version
  And a valid auth token is available
  When the CLI resolves the framework source with no --framework flag
  Then it calls the GitHub Releases API
  And downloads the release asset tarball
  And extracts it to the cache directory
  And writes a .aidd-extracted marker file
  And reads framework.json from the extracted root

Scenario: Authentication failure on private repository
  Given no auth token is available from any source
  When the CLI calls the GitHub Releases API for a private repository
  Then it fails with "Authentication failed. Run gh auth login to authenticate, or provide a token via --token or AIDD_TOKEN"

Scenario: GitHub tarball has single-directory nesting
  Given the downloaded tarball contains a single root directory (e.g. org-repo-sha/)
  When the CLI extracts the tarball
  Then it automatically descends into the nested directory to find framework.json

Scenario: Tarball with no nesting and no framework.json
  Given the downloaded tarball has no single root directory and no framework.json at any level
  When the CLI extracts and inspects it
  Then it fails with "No framework descriptor found in the downloaded tarball"

Scenario: Remote download completes within timeout
  Given a valid auth token is available and network is reachable
  When the CLI downloads the framework tarball
  Then the download completes in under 30 seconds
```

### Dependencies

- GitHub Releases API
- framework.json descriptor schema finalized with framework team

---

## US-002: "Use local framework source"

**As a** developer
**I want** to point the CLI to a local directory or tarball
**So that** I can work offline or test unreleased framework versions

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 3 pts      | Must     | Framework Resolution |

### Acceptance Criteria

```gherkin
Scenario: Local directory framework
  Given --framework points to a directory containing framework.json
  When the CLI resolves the framework source
  Then it loads directly from that directory without downloading

Scenario: Local tarball framework
  Given --framework points to a .tar.gz file containing a framework
  When the CLI resolves the framework source
  Then it extracts the tarball to a temporary directory
  And detects the framework root inside it
  And loads from the extracted directory

Scenario: Missing framework descriptor in local directory
  Given --framework points to a directory that exists but contains no framework.json
  When the CLI attempts to load the framework
  Then it fails with "No framework descriptor found in the specified directory"
```

### Dependencies

- US-001 (shares framework loading logic)

---

## US-003: "Cache downloaded frameworks"

**As a** developer
**I want** the CLI to cache downloaded frameworks
**So that** repeated commands do not trigger redundant downloads

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 3 pts      | Must     | Framework Resolution |

### Acceptance Criteria

```gherkin
Scenario: Cached framework reuse
  Given a cached framework exists for version 3.2.0 with marker file and framework.json
  When the CLI resolves the framework source for version 3.2.0
  Then it skips the download
  And loads directly from the cache directory

Scenario: Cache corrupted — marker file missing
  Given a cache directory exists for a version but the .aidd-extracted marker file is missing
  When the CLI resolves the framework source
  Then it re-downloads and re-extracts the framework

Scenario: Cache corrupted — framework.json missing
  Given a cache directory exists with a marker file but framework.json is missing
  When the CLI resolves the framework source
  Then it re-downloads and re-extracts the framework
```

### Dependencies

- US-001 (download produces the cache)

---

## US-004: "Offline fallback to cached framework"

**As a** developer
**I want** the CLI to fall back to a cached version when the network is unavailable
**So that** I can keep working offline

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 2 pts      | Must     | Framework Resolution |

### Acceptance Criteria

```gherkin
Scenario: Network failure with existing cache
  Given the network is unreachable
  And a cached framework version 3.1.0 exists with marker and framework.json
  When the CLI attempts to download the framework
  Then it falls back to the cached version 3.1.0
  And warns "Network unavailable. Using cached framework v3.1.0"

Scenario: Network failure with no cache
  Given the network is unreachable
  And no cached framework version exists
  When the CLI attempts to download the framework
  Then it fails with "Cannot reach the framework source. Check your network connection"

Scenario: Invalid tarball from network
  Given the downloaded file is not a valid .tar.gz
  When the CLI attempts to extract it
  Then it fails with "Downloaded file is not a valid tarball"
```

### Dependencies

- US-003 (cache must exist for fallback to work)

---

## US-005: "Auto-detect GitHub authentication token"

**As a** developer
**I want** the CLI to auto-detect my GitHub token
**So that** I do not have to pass credentials manually every time

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 2 pts      | Should   | Framework Resolution |

### Acceptance Criteria

```gherkin
Scenario: Token resolved from gh auth token
  Given the user has authenticated via gh CLI
  And no --token flag or AIDD_TOKEN env var is set
  When the CLI resolves the auth token
  Then it uses the output of gh auth token

Scenario: Token resolution priority
  Given --token flag is set to "flag-token"
  And AIDD_TOKEN env var is set to "env-token"
  And gh auth token returns "gh-token"
  When the CLI resolves the auth token
  Then it uses "flag-token" (flag > env > gh CLI)

Scenario: gh auth token hangs
  Given gh auth token does not respond within 3 seconds
  When the CLI resolves the auth token
  Then it times out and proceeds with no token
  And verbose mode logs the timeout
```

### Dependencies

- gh CLI (optional external dependency)

---

## US-026: "Custom framework repository source"

**As a** developer
**I want** to specify a custom framework repository
**So that** I can use a fork or private variant of the framework

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 2 pts      | Should   | Framework Resolution |

### Acceptance Criteria

```gherkin
Scenario: Custom repository via --repo flag
  Given the user has a private fork at my-org/my-framework
  When the user runs aidd install claude --repo my-org/my-framework
  Then the CLI downloads from my-org/my-framework instead of the default repository

Scenario: Repository from AIDD_REPO env var
  Given AIDD_REPO env var is set to "my-org/my-framework"
  And no --repo flag is provided
  When the CLI resolves the framework source
  Then it uses my-org/my-framework

Scenario: Repository resolution priority
  Given --repo is set to "flag-repo"
  And AIDD_REPO env var is set to "env-repo"
  And .aidd/settings.json contains "repo": "settings-repo"
  When the CLI resolves the repository
  Then it uses "flag-repo" (flag > env > settings > default)

Scenario: Invalid repository format
  Given the user runs aidd install claude --repo "not-a-valid-repo"
  When the CLI resolves the repository
  Then it fails with "Invalid repository format. Expected: owner/repo"
```

### Dependencies

- US-001 (remote download uses repository resolution)

---

# Epic: Docs Initialization

> Allow the developer to initialize the project's shared documentation structure in a single command.

## Scope Tier

**MVP**

## Justification NSM

Initialization is the CLI's entry point. A smooth and fast first experience is critical for adoption. If init fails or confuses the user, they will never proceed to install.

## User Stories

| ID     | User Story                                                                                                                                        | Points | Priority | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-006 | As a developer, I want to run a single command to set up the shared docs structure so that I do not have to create files and directories manually | 3      | Must     | ⬜     |
| US-007 | As a developer, I want to choose a custom docs directory name so that it fits my project conventions                                              | 2      | Should   | ⬜     |

**Legend** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Total Estimate

| Metric              | Value                                    |
| ------------------- | ---------------------------------------- |
| **Stories**         | 2                                        |
| **Total points**    | 5                                        |
| **Estimated sprints** | 1 (estimated velocity: 20 pts/sprint)  |

## Acceptance Criteria (epic level)

- [ ] aidd init creates the docs directory with templates from the framework
- [ ] A manifest (.aidd/config.json) is created and tracks docs files with hashes
- [ ] Custom docs directory name is persisted in the manifest

## Dependencies

| Dependency                 | Type      | Blocking? |
| -------------------------- | --------- | --------- |
| Epic: Framework Resolution | Technical | Yes       |

## Associated Spikes

| Spike | Objective | Time-box | Status |
| ----- | --------- | -------- | ------ |
| —     | —         | —        | —      |

---

## Validation

- [x] NSM justification documented
- [x] All stories follow INVEST
- [x] Gherkin acceptance criteria for each story
- [x] Total estimate < 13 points per story
- [x] Dependencies identified and mitigation plan in place

---

## US-006: "Initialize docs structure"

**As a** developer
**I want** to run a single command to set up the shared docs structure
**So that** I do not have to create files and directories manually

| Estimate   | Priority | Epic                |
| ---------- | -------- | ------------------- |
| 3 pts      | Must     | Docs Initialization |

### Acceptance Criteria

```gherkin
Scenario: First-time initialization
  Given no aidd_docs directory exists
  And no .aidd directory exists
  When the user runs aidd init
  Then the CLI resolves the framework source
  And creates aidd_docs/ with documentation templates from the framework
  And creates .aidd/config.json tracking docs files with their hashes
  And reports success with list of created files

Scenario: Docs directory already exists
  Given aidd_docs/ directory already exists
  When the user runs aidd init
  Then the CLI fails with a clear error indicating the directory already exists
  And no files are created or modified

Scenario: .aidd/ directory exists from partial init without manifest
  Given .aidd/ directory exists but contains no config.json
  When the user runs aidd init
  Then the CLI proceeds with initialization and creates the manifest
```

### Dependencies

- Epic: Framework Resolution (US-001 through US-005)

---

## US-007: "Custom docs directory name"

**As a** developer
**I want** to choose a custom docs directory name
**So that** it fits my project conventions

| Estimate   | Priority | Epic                |
| ---------- | -------- | ------------------- |
| 2 pts      | Should   | Docs Initialization |

### Acceptance Criteria

```gherkin
Scenario: Custom docs directory
  Given no my_docs directory exists
  When the user runs aidd init --docs-dir my_docs
  Then the CLI creates my_docs/ with documentation templates
  And the manifest stores "docsDir": "my_docs"

Scenario: Invalid docs directory name
  Given the user provides a directory name with special characters (e.g. "../escape")
  When the user runs aidd init --docs-dir "../escape"
  Then the CLI fails with a clear error rejecting the invalid name

Scenario: --docs-dir only accepted by init
  Given the user has already initialized with default docs dir
  When the user runs aidd install claude --docs-dir custom
  Then the CLI fails with an error indicating --docs-dir is only valid with init
```

### Dependencies

- US-006 (extends init behavior)

---

# Epic: Tool Distribution

> Allow the developer to generate the configuration files specific to each AI tool from the canonical framework.

## Scope Tier

**MVP**

## Justification NSM

This is the CLI's core value proposition. One-command installation is the primary driver of adoption. Without a working distribution, the product has no reason to exist.

## User Stories

| ID     | User Story                                                                                                                                                          | Points | Priority | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-008 | As a developer, I want to install the framework for one or more AI tools in a single command so that I do not have to manually create and adapt configuration files | 8      | Must     | ⬜     |
| US-010 | As a developer, I want the CLI to auto-initialize docs if no manifest exists when I run install so that I do not have to remember to run init first                 | 2      | Must     | ⬜     |
| US-011 | As a developer, I want to force-reinstall a tool so that I can regenerate all files from the latest framework version                                               | 2      | Should   | ⬜     |
| US-012 | As a developer, I want the CLI to handle Copilot-specific flattening and VS Code config merging so that Copilot integration works seamlessly                        | 3      | Must     | ⬜     |

**Legend** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Total Estimate

| Metric              | Value                                    |
| ------------------- | ---------------------------------------- |
| **Stories**         | 4                                        |
| **Total points**    | 15                                       |
| **Estimated sprints** | 1 (estimated velocity: 20 pts/sprint)  |

## Acceptance Criteria (epic level)

- [ ] aidd install generates correct distributions for Claude, Cursor, and Copilot
- [ ] Content placeholders, frontmatter, and include syntax are correctly rewritten per tool
- [ ] All generated files are tracked in the manifest with correct hashes
- [ ] Copilot flattening handles name collisions with auto-prefix

## Dependencies

| Dependency                 | Type      | Blocking?                  |
| -------------------------- | --------- | -------------------------- |
| Epic: Framework Resolution | Technical | Yes                        |
| Epic: Docs Initialization  | Technical | No (auto-init handles it)  |

## Associated Spikes

| Spike                       | Objective                                                                      | Time-box | Status |
| --------------------------- | ------------------------------------------------------------------------------ | -------- | ------ |
| Copilot flattening strategy | Validate auto-prefix approach on real framework with potential name collisions | 1 day    | ⬜     |
| VS Code settings.json merge | Validate deep merge strategy for array values (append vs deduplicate)          | 1 day    | ⬜     |

---

## Validation

- [x] NSM justification documented
- [x] All stories follow INVEST
- [x] Gherkin acceptance criteria for each story
- [x] Total estimate < 13 points per story
- [x] Dependencies identified and mitigation plan in place

---

## US-008: "Install framework for one or more tools"

**As a** developer
**I want** to install the framework for one or more AI tools in a single command
**So that** I do not have to manually create and adapt configuration files

| Estimate   | Priority | Epic              |
| ---------- | -------- | ----------------- |
| 8 pts      | Must     | Tool Distribution |

### Acceptance Criteria

```gherkin
Scenario: Install a single tool with content rewriting
  Given the project is initialized with aidd_docs and manifest
  When the user runs aidd install claude
  Then the CLI generates all Claude-specific files (agents, commands, rules, skills, memory bank, MCP config, README)
  And placeholders ({{TOOLS}}/, {{DOCS}}/) are replaced with Claude-specific paths
  And frontmatter uses Claude format (paths: list)
  And include syntax uses @.claude/path format
  And all files are recorded in the manifest with correct hashes

Scenario: Install multiple tools
  Given the project is initialized
  When the user runs aidd install claude cursor copilot
  Then the CLI generates distributions for all three tools
  And each tool has its own directory structure and content rewriting (placeholders, frontmatter, include syntax)
  And the manifest contains entries for all three tools

Scenario: Install with no arguments
  Given the project is initialized
  When the user runs aidd install
  Then the CLI fails with "At least one tool ID is required. Valid tools: claude, cursor, copilot"

Scenario: Invalid tool ID
  Given the project is initialized
  When the user runs aidd install invalid-tool
  Then the CLI fails with "Unknown tool: invalid-tool. Valid tools: claude, cursor, copilot"

Scenario: Cursor-specific content rewriting
  Given the framework contains a file with frontmatter paths
  When the CLI generates the Cursor distribution
  Then frontmatter uses Cursor format (globs/alwaysApply)
  And include syntax uses @.cursor/path format

Scenario: Copilot-specific content rewriting
  Given the framework contains a file with frontmatter and include references
  When the CLI generates the Copilot distribution
  Then frontmatter uses Copilot format (applyTo)
  And include syntax uses markdown link format
```

### Dependencies

- Epic: Framework Resolution
- US-006 (docs initialization, or auto-init via US-010)

---

## US-010: "Auto-initialize on install"

**As a** developer
**I want** the CLI to auto-initialize docs if no manifest exists when I run install
**So that** I do not have to remember to run init first

| Estimate   | Priority | Epic              |
| ---------- | -------- | ----------------- |
| 2 pts      | Must     | Tool Distribution |

### Acceptance Criteria

```gherkin
Scenario: Auto-init on install
  Given no manifest exists
  When the user runs aidd install claude
  Then the CLI runs init automatically first with default docs directory
  And reports "No installation found. Initializing docs first..."
  And then proceeds with tool installation

Scenario: Auto-init does not override custom docs dir
  Given no manifest exists
  And the user wants a custom docs directory
  When the user runs aidd install claude
  Then the CLI initializes with the default docs directory name
  And the user would need to run aidd init --docs-dir <name> first for a custom name

Scenario: Manifest already exists
  Given a manifest already exists
  When the user runs aidd install cursor
  Then the CLI skips init and proceeds directly to installation
```

### Dependencies

- US-006 (init logic)
- US-008 (install logic)

---

## US-011: "Force reinstall a tool"

**As a** developer
**I want** to force-reinstall a tool
**So that** I can regenerate all files from the latest framework version

| Estimate   | Priority | Epic              |
| ---------- | -------- | ----------------- |
| 2 pts      | Should   | Tool Distribution |

### Acceptance Criteria

```gherkin
Scenario: Force reinstall
  Given claude is already installed
  When the user runs aidd install claude --force
  Then the CLI regenerates all Claude files
  And updates the manifest with new hashes

Scenario: Tool already installed without force
  Given claude is already installed
  When the user runs aidd install claude
  Then the CLI skips installation and reports "claude is already installed. Use --force to reinstall."

Scenario: Force install when tool directory exists but not in manifest
  Given a .claude/ directory exists on disk but claude is not in the manifest
  When the user runs aidd install claude --force
  Then the CLI overwrites files with a warning and records them in the manifest
```

### Dependencies

- US-008 (install logic)

---

## US-012: "Copilot flattening and VS Code config merging"

**As a** developer
**I want** the CLI to handle Copilot-specific flattening and VS Code config merging
**So that** Copilot integration works seamlessly

| Estimate   | Priority | Epic              |
| ---------- | -------- | ----------------- |
| 3 pts      | Must     | Tool Distribution |

### Acceptance Criteria

```gherkin
Scenario: Copilot command flattening with no collisions
  Given the framework has commands in different phase subdirectories with unique names
  When the CLI generates the Copilot distribution
  Then commands are flattened to a single directory level

Scenario: Copilot flattening with name collision
  Given the framework has two commands with the same name in different phases
  When the CLI generates the Copilot distribution
  Then it auto-prefixes the colliding file with its phase number (e.g. 04-implement.prompt.md)
  And emits a warning about the collision

Scenario: VS Code settings.json merge with existing user content
  Given .vscode/settings.json already exists with user-defined values
  When the CLI installs Copilot
  Then it deep merges AIDD settings into the existing file
  And preserves user values
  And warns on conflicting keys
```

### Dependencies

- US-008 (install logic and content rewriting)

---

# Epic: Lifecycle Management

> Allow the developer to manage the full lifecycle of their AIDD installation: tool uninstallation, status checking, global cleanup, and diagnostics.

## Scope Tier

**MVP**

## Justification NSM

Lifecycle commands (uninstall, status, clean, doctor) build trust. A developer who knows they can cleanly uninstall and diagnose problems will adopt the CLI with less hesitation.

## User Stories

| ID     | User Story                                                                                                                                         | Points | Priority | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-013 | As a developer, I want to uninstall a tool's configuration without affecting other tools or docs so that I can safely remove tools I no longer use | 3      | Must     | ⬜     |
| US-014 | As a developer, I want to see at a glance which files have drifted from the installed framework version so that I know what has changed            | 5      | Must     | ⬜     |
| US-015 | As a developer, I want to filter status output by tool so that I can focus on a specific tool's drift                                              | 1      | Should   | ⬜     |
| US-016 | As a developer, I want to remove all AIDD traces from my project in a single command so that I can cleanly abandon or reset the installation       | 3      | Must     | ⬜     |
| US-017 | As a developer, I want to run a health check on my installation so that I can detect corrupted manifests, orphaned directories and fix them        | 3      | Must     | ⬜     |
| US-018 | As a developer, I want verbose output on any command so that I can debug framework resolution and file operation issues                            | 2      | Should   | ⬜     |
| US-027 | As a developer, I want to configure CLI defaults in a project settings file so that I do not have to repeat flags on every command                 | 2      | Should   | ⬜     |

**Legend** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Total Estimate

| Metric              | Value                                    |
| ------------------- | ---------------------------------------- |
| **Stories**         | 7                                        |
| **Total points**    | 19                                       |
| **Estimated sprints** | 1 (estimated velocity: 20 pts/sprint)  |

## Acceptance Criteria (epic level)

- [ ] Uninstall removes only the target tool's files and updates the manifest
- [ ] Status accurately classifies files as unmodified, modified, deleted, or added
- [ ] Clean removes all AIDD-managed files and the manifest
- [ ] Doctor detects and reports manifest corruption, orphaned directories, and hash mismatches
- [ ] Verbose mode outputs diagnostics to stderr without polluting stdout
- [ ] Settings file (.aidd/settings.json) stores project-level defaults with correct resolution priority

## Dependencies

| Dependency                | Type      | Blocking?                                                |
| ------------------------- | --------- | -------------------------------------------------------- |
| Epic: Tool Distribution   | Technical | Yes (tools must be installed to uninstall/status/doctor) |
| Epic: Docs Initialization | Technical | Yes (manifest must exist)                                |

## Associated Spikes

| Spike | Objective | Time-box | Status |
| ----- | --------- | -------- | ------ |
| —     | —         | —        | —      |

---

## Validation

- [x] NSM justification documented
- [x] All stories follow INVEST
- [x] Gherkin acceptance criteria for each story
- [x] Total estimate < 13 points per story
- [x] Dependencies identified and mitigation plan in place

---

## US-013: "Uninstall a tool cleanly"

**As a** developer
**I want** to uninstall a tool's configuration without affecting other tools or docs
**So that** I can safely remove tools I no longer use

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 3 pts      | Must     | Lifecycle Management |

### Acceptance Criteria

```gherkin
Scenario: Uninstall a single tool
  Given claude and cursor are installed
  When the user runs aidd uninstall claude
  Then all Claude-tracked files are deleted from disk
  And empty directories left behind are cleaned up
  And the manifest no longer contains a claude entry
  And cursor files and docs are untouched

Scenario: Uninstall multiple tools
  Given claude, cursor, and copilot are installed
  When the user runs aidd uninstall claude cursor
  Then all Claude-tracked and Cursor-tracked files are deleted
  And copilot files and docs are untouched
  And the manifest no longer contains claude or cursor entries

Scenario: Uninstall non-installed tool
  Given only claude is installed
  When the user runs aidd uninstall cursor
  Then the CLI fails with "cursor is not installed"

Scenario: Some tracked files already manually deleted
  Given claude is installed and the user has manually deleted some Claude files
  When the user runs aidd uninstall claude
  Then the CLI skips missing files and removes the rest
  And updates the manifest to remove the claude entry
```

### Dependencies

- US-008 (tool must be installed first)

---

## US-014: "View file drift status"

**As a** developer
**I want** to see at a glance which files have drifted from the installed framework version
**So that** I know what has changed

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 5 pts      | Must     | Lifecycle Management |

### Acceptance Criteria

```gherkin
Scenario: All files in sync
  Given claude is installed and no files have been modified
  When the user runs aidd status
  Then the CLI reports "All files are in sync"
  And displays the installed framework version for claude and docs

Scenario: Detect drift
  Given claude is installed
  And the user has modified one file, deleted another, and created a new untracked file
  When the user runs aidd status
  Then the CLI reports 1 modified file, 1 deleted file, and 1 added file for claude

Scenario: Detect docs drift
  Given docs are initialized and the user has modified a docs template file
  When the user runs aidd status
  Then the CLI reports the modified docs file in a separate "docs" group

Scenario: No manifest exists
  Given no .aidd directory exists
  When the user runs aidd status
  Then the CLI fails with "No AIDD installation found. Run aidd init first."

Scenario: Status shows available update
  Given claude is installed at version 3.0.0
  And the latest framework version is 3.1.0
  When the user runs aidd status
  Then the CLI reports file drift as usual
  And displays "Update available: v3.0.0 → v3.1.0"

Scenario: Status version check with network failure
  Given claude is installed at version 3.0.0
  And the network is unreachable
  When the user runs aidd status
  Then the CLI reports file drift as usual
  And does not display any version check information (silent fallback)
```

### Dependencies

- US-006 (manifest must exist)

---

## US-015: "Filter status by tool"

**As a** developer
**I want** to filter status output by tool
**So that** I can focus on a specific tool's drift

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 1 pts      | Should   | Lifecycle Management |

### Acceptance Criteria

```gherkin
Scenario: Status filtered by tool
  Given claude and cursor are installed
  And the user has modified files in both tools
  When the user runs aidd status --tool claude
  Then the CLI reports only claude's modified/deleted/added files
  And does not show cursor or docs

Scenario: --tool with invalid tool name
  Given claude is installed
  When the user runs aidd status --tool invalid
  Then the CLI fails with an error listing valid installed tools

Scenario: --tool with non-installed tool
  Given only claude is installed
  When the user runs aidd status --tool cursor
  Then the CLI fails with "cursor is not installed"
```

### Dependencies

- US-014 (extends status behavior)

---

## US-016: "Clean all AIDD traces"

**As a** developer
**I want** to remove all AIDD traces from my project in a single command
**So that** I can cleanly abandon or reset the installation

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 3 pts      | Must     | Lifecycle Management |

### Acceptance Criteria

```gherkin
Scenario: Clean all installations
  Given claude and cursor are installed with docs
  When the user runs aidd clean --force
  Then all tracked tool files are deleted
  And all tracked docs files are deleted
  And the .aidd directory is removed
  And the project has no trace of AIDD installation

Scenario: Clean without force
  Given claude is installed
  When the user runs aidd clean
  Then the CLI displays a summary of what would be removed
  And fails with "Use --force to confirm removal"

Scenario: Untracked user files in tool directories
  Given claude is installed and the user has created custom files in .claude/ not tracked by the manifest
  When the user runs aidd clean --force
  Then only manifest-tracked files are deleted
  And untracked user files in tool directories are preserved

Scenario: Nothing to clean
  Given no .aidd directory exists
  When the user runs aidd clean
  Then the CLI reports "Nothing to clean. No AIDD installation found."
```

### Dependencies

- US-006 (manifest must exist for clean to find tracked files)

---

## US-017: "Run installation health check"

**As a** developer
**I want** to run a health check on my installation
**So that** I can detect corrupted manifests, orphaned directories and fix them

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 3 pts      | Must     | Lifecycle Management |

### Acceptance Criteria

```gherkin
Scenario: Healthy installation
  Given claude is installed and all tracked files exist with matching hashes
  When the user runs aidd doctor
  Then the CLI reports "Installation is healthy"
  And lists the number of tracked files per tool and docs

Scenario: Detect issues
  Given claude is installed
  And one file has a hash mismatch
  And a .windsurf/ directory exists but windsurf is not in the manifest
  When the user runs aidd doctor
  Then the CLI reports 1 corrupted file and 1 orphaned directory
  And suggests actionable fixes for each issue

Scenario: Corrupted manifest JSON
  Given .aidd/config.json exists but is not valid JSON
  When the user runs aidd doctor
  Then the CLI reports "Manifest is corrupted (invalid JSON)"
  And suggests "Run aidd clean --force and re-initialize"

Scenario: No manifest
  Given no .aidd directory exists
  When the user runs aidd doctor
  Then the CLI reports "AIDD is not initialized. Run aidd init to get started."
```

### Dependencies

- US-006 (manifest existence)

---

## US-018: "Verbose output for debugging"

**As a** developer
**I want** verbose output on any command
**So that** I can debug framework resolution and file operation issues

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 2 pts      | Should   | Lifecycle Management |

### Acceptance Criteria

```gherkin
Scenario: Verbose output during install
  Given the user runs aidd install claude --verbose
  When the CLI resolves the framework source and writes files
  Then it logs framework resolution details to stderr (source type, URL, cache status)
  And logs auth method used without revealing token value
  And logs each file written with its path
  And normal output goes to stdout

Scenario: Verbose mode on error
  Given the user runs aidd install claude --verbose
  And the network is unreachable and no cache exists
  When the CLI fails to resolve the framework
  Then it logs the HTTP request attempt details to stderr (URL, method, error type)
  And the user-facing error message goes to stderr

Scenario: Without verbose no diagnostic output
  Given the user runs aidd install claude without --verbose
  When the CLI completes successfully
  Then no diagnostic output is emitted to stderr
  And only the normal output goes to stdout
```

### Dependencies

- None (cross-cutting concern applied to all commands)

---

## US-027: "Project settings file"

**As a** developer
**I want** to configure CLI defaults in a project settings file
**So that** I do not have to repeat flags on every command

| Estimate   | Priority | Epic                 |
| ---------- | -------- | -------------------- |
| 2 pts      | Should   | Lifecycle Management |

### Acceptance Criteria

```gherkin
Scenario: Settings file provides default repo
  Given .aidd/settings.json contains "repo": "my-org/my-framework"
  And no --repo flag is provided
  And no AIDD_REPO env var is set
  When the CLI resolves the framework source
  Then it uses "my-org/my-framework" from the settings file

Scenario: CLI flag overrides settings file
  Given .aidd/settings.json contains "repo": "settings-repo"
  And the user runs aidd install claude --repo flag-repo
  When the CLI resolves the framework source
  Then it uses "flag-repo" (flag > env > settings > default)

Scenario: Settings file does not exist
  Given no .aidd/settings.json file exists
  When the CLI resolves configuration
  Then it uses built-in defaults without error

Scenario: Token is never stored in settings file
  Given the user attempts to write a token to .aidd/settings.json
  When the CLI reads the settings file
  Then it ignores any "token" key in the settings file
  And auth token resolution uses only --token flag, AIDD_TOKEN env, or gh auth token
```

### Dependencies

- US-006 (manifest and .aidd directory must exist)

---

# Epic: Framework Updates

> Allow the developer to update their installed distributions to the latest framework version and restore modified files to their original version.

## Scope Tier

**Next Release** (v3.1+)

## Justification NSM

Updates are the second driver of long-term adoption. A user who cannot update easily will abandon the CLI when the framework evolves. Promotion conditional on adoption > 30%.

## User Stories

| ID     | User Story                                                                                                                                                     | Points | Priority | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-019 | As a developer, I want to update my installed distributions to the latest framework version so that I benefit from community improvements without manual work  | 5      | Should   | ⬜     |
| US-020 | As a developer, I want the update to detect my local modifications and let me choose whether to keep or overwrite them so that I do not lose my customizations | 5      | Should   | ⬜     |
| US-021 | As a developer, I want to restore specific files to their original framework version so that I can undo accidental changes                                     | 5      | Should   | ⬜     |

**Legend** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Total Estimate

| Metric              | Value                                    |
| ------------------- | ---------------------------------------- |
| **Stories**         | 3                                        |
| **Total points**    | 15                                       |
| **Estimated sprints** | 1 (estimated velocity: 20 pts/sprint)  |

## Acceptance Criteria (epic level)

- [ ] Update downloads the latest framework and applies a diff to each installed tool
- [ ] User-modified files are detected and handled interactively (or forced)
- [ ] Restore regenerates files from the pinned framework version
- [ ] Manifest is updated with new hashes and versions after update/restore

## Dependencies

| Dependency                          | Type      | Blocking?                                       |
| ----------------------------------- | --------- | ----------------------------------------------- |
| Epic: Lifecycle Management (status) | Technical | Yes (drift detection needed for update/restore) |
| Community adoption > 30%            | Business  | Yes (promotion trigger)                         |

## Associated Spikes

| Spike                | Objective                                                                                    | Time-box | Status |
| -------------------- | -------------------------------------------------------------------------------------------- | -------- | ------ |
| Update diff strategy | Validate added/removed/changed/unchanged classification on real framework version transition | 1 day    | ⬜     |

---

## Validation

- [x] NSM justification documented
- [x] All stories follow INVEST
- [x] Gherkin acceptance criteria for each story
- [x] Total estimate < 13 points per story
- [x] Dependencies identified and mitigation plan in place

---

## US-019: "Update distributions to latest framework"

**As a** developer
**I want** to update my installed distributions to the latest framework version
**So that** I benefit from community improvements without manual work

| Estimate   | Priority | Epic              |
| ---------- | -------- | ----------------- |
| 5 pts      | Should   | Framework Updates |

### Acceptance Criteria

```gherkin
Scenario: Update all tools to latest framework
  Given claude and cursor are installed at version 3.0.0
  And the latest framework version is 3.1.0
  When the user runs aidd update
  Then the CLI downloads framework 3.1.0
  And computes the diff for each tool (added, removed, changed, unchanged files)
  And writes new and changed files
  And deletes removed files
  And updates the manifest with new hashes and version 3.1.0

Scenario: Already up to date
  Given claude is installed at version 3.1.0
  And the latest framework version is 3.1.0
  When the user runs aidd update
  Then the CLI reports "Already up to date (v3.1.0)"

Scenario: No manifest exists
  Given no .aidd directory exists
  When the user runs aidd update
  Then the CLI fails with "No AIDD installation found. Run aidd init first."
```

### Dependencies

- Epic: Framework Resolution (download latest)
- US-014 (drift detection logic)

---

## US-020: "Handle local modifications during update"

**As a** developer
**I want** the update to detect my local modifications and let me choose whether to keep or overwrite them
**So that** I do not lose my customizations

| Estimate   | Priority | Epic              |
| ---------- | -------- | ----------------- |
| 5 pts      | Should   | Framework Updates |

### Acceptance Criteria

```gherkin
Scenario: User-modified files detected during update (interactive, v3.1+)
  Given claude is installed and the user has modified a rule file
  And a new framework version is available
  When the user runs aidd update
  Then the CLI lists each modified file and prompts "keep" or "overwrite" per file
  And applies the user's choice for each file
  And the manifest reflects the actual state of each file

Scenario: Force update overwrites all
  Given claude is installed with user-modified files
  When the user runs aidd update --force
  Then the CLI overwrites all user-modified files without prompting
  And updates the manifest

Scenario: Update without modified files skips prompts
  Given claude is installed with no local modifications
  And a new framework version is available
  When the user runs aidd update
  Then the CLI applies all changes without prompting
```

### Dependencies

- US-019 (update command)

---

## US-021: "Restore specific files to framework version"

**As a** developer
**I want** to restore specific files to their original framework version
**So that** I can undo accidental changes

| Estimate   | Priority | Epic              |
| ---------- | -------- | ----------------- |
| 5 pts      | Should   | Framework Updates |

### Acceptance Criteria

```gherkin
Scenario: Restore a modified file using pinned version
  Given claude is installed at version 3.0.0
  And the latest available version is 3.1.0
  And the user has modified .claude/rules/01-standards/1-command-structure.md
  When the user runs aidd restore .claude/rules/01-standards/1-command-structure.md
  Then the CLI downloads framework version 3.0.0 (not 3.1.0)
  And regenerates the file from that version
  And updates the manifest with the new hash

Scenario: Restore all with force
  Given claude is installed with 2 modified and 1 deleted file
  When the user runs aidd restore --force
  Then the CLI restores all 3 files to their framework version
  And updates the manifest

Scenario: Restoring a deleted file recreates it
  Given the user has deleted .claude/agents/alexia.md
  When the user runs aidd restore .claude/agents/alexia.md
  Then the CLI recreates the file in the correct location from the pinned framework version

Scenario: Pinned version no longer available remotely
  Given claude was installed from framework version 3.0.0
  And version 3.0.0 is no longer available remotely
  When the user runs aidd restore
  Then the CLI falls back to the latest version
  And warns "Version 3.0.0 is no longer available. Restoring from latest (3.1.0)."

Scenario: Nothing to restore
  Given claude is installed and all files match the manifest
  When the user runs aidd restore
  Then the CLI reports "All files are in sync. Nothing to restore."
```

### Dependencies

- US-014 (status logic identifies restorable files)
- US-003 (cache for version pinning)

---

# Epic: Cross-Tool Sync

> Allow the developer to propagate their changes from one tool to all other installed tools.

## Scope Tier

**Next Release** (v3.1+)

## Justification NSM

Sync is the differentiator for multi-tool users. Propagating a change made in Claude to Cursor and Copilot in a single command eliminates the last major friction. Promotion conditional on confirmed multi-tool adoption.

## User Stories

| ID     | User Story                                                                                                                                                  | Points | Priority | Status |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-023 | As a developer, I want to propagate my changes from one tool to all other installed tools so that my customizations stay consistent across my AI assistants | 5      | Could    | ⬜     |
| US-024 | As a developer, I want the CLI to detect conflicts when the target tool also has modifications so that I do not accidentally overwrite other changes        | 3      | Could    | ⬜     |
| US-025 | As a developer, I want to sync to a specific target tool instead of all so that I can control exactly where changes propagate                               | 2      | Could    | ⬜     |

**Legend** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Total Estimate

| Metric              | Value                                    |
| ------------------- | ---------------------------------------- |
| **Stories**         | 3                                        |
| **Total points**    | 10                                       |
| **Estimated sprints** | 1 (estimated velocity: 20 pts/sprint)  |

## Acceptance Criteria (epic level)

- [ ] Sync reverse-rewrites source tool content to canonical format, then forward-rewrites to each target
- [ ] Conflicts are detected and reported, not silently overwritten
- [ ] Memory bank files, MCP config, docs, VS Code files, and manifest are never propagated
- [ ] Requires at least 2 installed tools

## Dependencies

| Dependency                                  | Type      | Blocking?               |
| ------------------------------------------- | --------- | ----------------------- |
| Epic: Tool Distribution (content rewriting) | Technical | Yes                     |
| Epic: Lifecycle Management (status)         | Technical | Yes                     |
| Community multi-tool usage confirmation     | Business  | Yes (promotion trigger) |

## Associated Spikes

| Spike                       | Objective                                                                                   | Time-box | Status |
| --------------------------- | ------------------------------------------------------------------------------------------- | -------- | ------ |
| Reverse-rewrite feasibility | Validate that tool-specific content can be losslessly reverse-rewritten to canonical format | 2 days   | ⬜     |

---

## Validation

- [x] NSM justification documented
- [x] All stories follow INVEST
- [x] Gherkin acceptance criteria for each story
- [x] Total estimate < 13 points per story
- [x] Dependencies identified and mitigation plan in place

---

## US-023: "Propagate changes across tools"

**As a** developer
**I want** to propagate my changes from one tool to all other installed tools
**So that** my customizations stay consistent across my AI assistants

| Estimate   | Priority | Epic            |
| ---------- | -------- | --------------- |
| 5 pts      | Could    | Cross-Tool Sync |

### Acceptance Criteria

```gherkin
Scenario: Propagate changes from one tool to another
  Given claude and cursor are installed
  And the user has modified .claude/rules/01-standards/1-command-structure.md
  When the user runs aidd sync --source claude
  Then the CLI reverse-rewrites the modified file to canonical format
  And forward-rewrites it to Cursor format
  And writes the result to the Cursor rules directory
  And updates the manifest for both tools

Scenario: Fewer than 2 tools installed
  Given only claude is installed
  When the user runs aidd sync --source claude
  Then the CLI fails with "Sync requires at least 2 installed tools"

Scenario: Skip identical content
  Given claude and cursor are installed
  And a file was modified in claude but the cursor version already has identical content
  When the user runs aidd sync --source claude
  Then the CLI skips that file for cursor

Scenario: Excluded files are never propagated
  Given claude and cursor are installed
  And the user has modified memory bank files and MCP config in claude
  When the user runs aidd sync --source claude
  Then memory bank files, MCP config, VS Code files, docs files, and manifest are not propagated
```

### Dependencies

- US-008 (content rewriting logic, used in reverse)
- US-014 (status to detect changes)

---

## US-024: "Detect sync conflicts"

**As a** developer
**I want** the CLI to detect conflicts when the target tool also has modifications
**So that** I do not accidentally overwrite other changes

| Estimate   | Priority | Epic            |
| ---------- | -------- | --------------- |
| 3 pts      | Could    | Cross-Tool Sync |

### Acceptance Criteria

```gherkin
Scenario: Conflict detected
  Given claude and cursor are installed
  And the user has modified the same rule in both tools
  When the user runs aidd sync --source claude
  Then the CLI reports the conflict
  And does not overwrite the cursor version
  And lists the conflicting file for manual resolution

Scenario: Force sync overwrites conflicts
  Given the same conflict scenario
  When the user runs aidd sync --source claude --force
  Then the CLI applies all changes including conflicts without prompting
  And updates the manifest

Scenario: No conflicts
  Given claude and cursor are installed
  And only claude has modifications, cursor files are unmodified
  When the user runs aidd sync --source claude
  Then all changes propagate without conflict warnings
```

### Dependencies

- US-023 (sync logic)
- US-014 (status detects modifications in target)

---

## US-025: "Sync to a specific target tool"

**As a** developer
**I want** to sync to a specific target tool instead of all
**So that** I can control exactly where changes propagate

| Estimate   | Priority | Epic            |
| ---------- | -------- | --------------- |
| 2 pts      | Could    | Cross-Tool Sync |

### Acceptance Criteria

```gherkin
Scenario: Sync to specific target
  Given claude, cursor, and copilot are installed
  And the user has modified a file in claude
  When the user runs aidd sync --source claude --target cursor
  Then changes propagate only to cursor
  And copilot files are untouched

Scenario: Target tool not installed
  Given claude and cursor are installed
  When the user runs aidd sync --source claude --target copilot
  Then the CLI fails with "copilot is not installed"

Scenario: Source and target are the same
  Given claude and cursor are installed
  When the user runs aidd sync --source claude --target claude
  Then the CLI fails with a clear error indicating source and target must be different
```

### Dependencies

- US-023 (sync logic)

---

# Epic: Manual Installation Migration

> Allow a developer who installed the AIDD framework manually (before the CLI was available) to migrate to CLI-managed state in a single command.

## Scope Tier

**v3.3**

## Justification NSM

The CLI launched after the community had already adopted the framework manually. Without an adoption path, early adopters cannot migrate to CLI-managed state and benefit from update, restore, and sync. This is a direct adoption unlock.

## User Stories

| ID     | User Story                                                                                                                                              | Points | Priority | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-028 | As a developer who installed the framework manually, I want to run `aidd adopt` so that my existing files are brought under CLI management without loss | 5      | Must     | ⬜     |

**Legend** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Total Estimate

| Metric              | Value                                   |
| ------------------- | --------------------------------------- |
| **Stories**         | 1                                       |
| **Total points**    | 5                                       |
| **Estimated sprints** | < 1 (estimated velocity: 20 pts/sprint) |

## Acceptance Criteria (epic level)

- [ ] `aidd adopt` detects installed tools without a manifest
- [ ] Conflict handling matches `aidd update` behavior
- [ ] Manifest is created with correct post-write hashes
- [ ] `aidd init` redirects to `aidd adopt` when existing files are detected

## Dependencies

| Dependency              | Type      | Blocking? |
| ----------------------- | --------- | --------- |
| UpdateUseCase (M6)      | Technical | No (reuse pattern, not code) |
| FrameworkResolver (M2)  | Technical | Yes       |

---

## US-028: "Migrate manual framework installation to CLI-managed state"

**As a** developer who installed the AIDD framework manually
**I want** to run `aidd adopt`
**So that** my existing files are brought under CLI management and I can use update, restore, and sync

| Estimate | Priority | Epic                          |
| -------- | -------- | ----------------------------- |
| 5 pts    | Must     | Manual Installation Migration |

### Acceptance Criteria

```gherkin
Scenario: Adopt with existing files — no conflicts (user accepts all)
  Given a project with .claude/ and aidd_docs/ files but no .aidd/manifest.json
  When the user runs aidd adopt
  Then the CLI detects claude as an installed tool
  And downloads the latest framework
  And prompts for each file that exists on disk
  And writes each file the user accepts to overwrite
  And creates .aidd/manifest.json with post-write hashes
  And reports a summary of written and kept files

Scenario: Adopt with --force
  Given a project with manually installed files and no manifest
  When the user runs aidd adopt --force
  Then all files are overwritten without prompting
  And a .backup copy is created for each overwritten file
  And the manifest is created

Scenario: Orphan files not in framework
  Given a project with custom files not present in the framework distribution
  When the user runs aidd adopt
  Then the custom files are not touched
  And a warning is logged for each orphan file

Scenario: aidd init blocked when files exist
  Given a project with existing .claude/ directory
  When the user runs aidd init
  Then the CLI exits with error "AIDD files detected. Use `aidd adopt` to migrate your existing installation."

Scenario: aidd status clean after adopt
  Given aidd adopt completed successfully
  When the user runs aidd status
  Then all tracked files are reported as in sync
```

### Dependencies

- UpdateUseCase conflict handling pattern (M6)
- FrameworkResolver (M2)

---

# Backlog Summary

## Points per epic

| Epic                          | Scope | Stories | Points | Sprints |
| ----------------------------- | ----- | ------- | ------ | ------- |
| Framework Resolution          | MVP   | 6       | 17     | 1       |
| Docs Initialization           | MVP   | 2       | 5      | < 1     |
| Tool Distribution             | MVP   | 4       | 15     | 1       |
| Lifecycle Management          | MVP   | 7       | 19     | 1       |
| Framework Updates             | v3.1+ | 3       | 15     | 1       |
| Cross-Tool Sync               | v3.1+ | 3       | 10     | < 1     |
| Manual Installation Migration | v3.3  | 1       | 5      | < 1     |
| **Total**                     |       | **26**  | **86** | **~5**  |

## MVP Breakdown

| Metric                  | Value                        |
| ----------------------- | ---------------------------- |
| **Stories MVP**         | 19                           |
| **Points MVP**          | 56                           |
| **Estimated MVP sprints** | 3 (velocity: 20 pts/sprint) |

## v3.1+ Breakdown

| Metric                    | Value                        |
| ------------------------- | ---------------------------- |
| **Stories v3.1+**         | 6                            |
| **Points v3.1+**          | 25                           |
| **Estimated v3.1+ sprints** | 2 (velocity: 20 pts/sprint) |

## v3.3 Breakdown

| Metric                    | Value                        |
| ------------------------- | ---------------------------- |
| **Stories v3.3**          | 1                            |
| **Points v3.3**           | 5                            |
| **Estimated v3.3 sprints** | < 1 (velocity: 20 pts/sprint) |

---

# Definition of Done

> Quality criteria applicable to **all** user stories in the project. A story is only "done" if **all** these criteria are met.

## Standard Criteria

| #   | Criterion               | Description                                                                      | Verified by |
| --- | ----------------------- | -------------------------------------------------------------------------------- | ----------- |
| 1   | **Acceptance criteria** | All Gherkin scenarios for the story pass                                         | PM / QA     |
| 2   | **Code review**         | Code has been reviewed and approved by at least 1 peer                           | Dev         |
| 3   | **Tests**               | Unit and/or E2E tests written and passing                                        | Dev / QA    |
| 4   | **Documentation**       | Technical documentation updated if needed                                        | Dev         |
| 5   | **Deployment**          | The story passes `pnpm validate` and a manual smoke test on a real project       | Dev         |

## Project-Specific Criteria

| #   | Criterion              | Description                                                                                                          | Verified by    |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- |
| 6   | **Zero data loss**     | The operation never deletes a file not tracked by the manifest unless the user explicitly requests it                | Dev / QA       |
| 7   | **Performance**        | Local operations complete in < 5 seconds for a standard framework (~100 files)                                       | Dev            |
| 8   | **Error messages**     | Every error includes an actionable message indicating how to resolve the problem                                     | Dev / QA       |
| 9   | **Token security**     | No authentication token is written to disk, logged to stdout/stderr, or included in error messages                   | Dev / Security |
| 10  | **Cross-platform**     | The story works on macOS, Linux, and WSL                                                                             | Dev / QA       |
| 11  | **Clean Architecture** | The domain layer has no infrastructure imports                                                                       | Dev            |
| 12  | **Dependency limit**   | Maximum 2 direct runtime dependencies respected                                                                      | Dev            |
| 13  | **Manifest compat**    | If the manifest format changes, automatic migration of existing installations is implemented                         | Dev            |
| 14  | **No hardcoded paths** | The domain layer uses the framework descriptor, never hardcoded paths (agents/, commands/, etc.)                     | Dev            |

## Exceptions

| Story type    | Adjusted criteria                      | Reason                                    |
| ------------- | -------------------------------------- | ----------------------------------------- |
| **Spike**     | No tests, deliverable = report         | Investigation, no implementation          |
| **Prototype** | No code review, no E2E tests           | Throwaway by design                       |

---

## Validation

- [ ] DoD validated by the team (PM + Dev Lead + QA)
- [ ] Criteria are measurable and verifiable
- [ ] Exceptions documented and limited
- [ ] DoD accessible to the entire team
