# AIDD CLI — User Stories

> Backlog complet du projet AIDD CLI v3.0 et v3.1+, organisé par epics.
> North Star Metric : 70% d'adoption communautaire dans les 6 mois.
> Vélocité : 20 pts/sprint — Sprint : 2 semaines.

---

# Epic: Framework Resolution

> Permettre au CLI de télécharger, extraire, mettre en cache et charger le framework canonique depuis une source distante, un tarball local ou un répertoire local.

## Scope Tier

**MVP**

## Justification NSM

Sans résolution du framework, aucune commande ne peut fonctionner. C'est la fondation technique sur laquelle reposent init, install et toutes les commandes suivantes. Adoption = 0% sans cette brique.

## User Stories

| ID     | User Story                                                                                                                               | Points | Priorité | Status |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-001 | As a developer, I want the CLI to download the latest framework from GitHub so that I always work with the most recent community content | 5      | Must     | ⬜     |
| US-002 | As a developer, I want to point the CLI to a local directory or tarball so that I can work offline or test unreleased framework versions | 3      | Must     | ⬜     |
| US-003 | As a developer, I want the CLI to cache downloaded frameworks so that repeated commands do not trigger redundant downloads               | 3      | Must     | ⬜     |
| US-004 | As a developer, I want the CLI to fall back to a cached version when the network is unavailable so that I can keep working offline       | 2      | Must     | ⬜     |
| US-005 | As a developer, I want the CLI to auto-detect my GitHub token so that I do not have to pass credentials manually every time              | 2      | Should   | ⬜     |
| US-026 | As a developer, I want to specify a custom framework repository so that I can use a fork or private variant of the framework             | 2      | Should   | ⬜     |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Estimation totale

| Métrique            | Valeur                               |
| ------------------- | ------------------------------------ |
| **Stories**         | 6                                    |
| **Points totaux**   | 17                                   |
| **Sprints estimés** | 1 (vélocité estimée : 20 pts/sprint) |

## Critères d'acceptation (niveau epic)

- [ ] The CLI resolves a framework from remote, tarball, and local directory sources
- [ ] Caching prevents redundant downloads across sessions
- [ ] Offline fallback works when a cache exists
- [ ] Auth token is never written to disk or logged

## Dépendances

| Dépendance                       | Type      | Bloquant ?                  |
| -------------------------------- | --------- | --------------------------- |
| GitHub Releases API availability | Externe   | Non (local fallback exists) |
| framework.json descriptor schema | Technique | Oui                         |

## Spikes associés

| Spike                            | Objectif                                                               | Time-box | Status |
| -------------------------------- | ---------------------------------------------------------------------- | -------- | ------ |
| GitHub tarball nesting detection | Validate single-directory nesting pattern across different GitHub orgs | 1 jour   | ⬜     |

---

## Validation

- [x] Justification NSM documentée
- [x] Toutes les stories respectent INVEST
- [x] Acceptance criteria Gherkin pour chaque story
- [x] Estimation totale < 13 points par story
- [x] Dépendances identifiées et plan de mitigation

---

## US-001: "Download latest framework from remote"

**As a** developer
**I want** the CLI to download the latest framework from GitHub
**So that** I always work with the most recent community content

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

> Permettre au développeur d'initialiser la structure de documentation partagée du projet en une seule commande.

## Scope Tier

**MVP**

## Justification NSM

L'initialisation est le point d'entrée du CLI. Une première expérience fluide et rapide est déterminante pour l'adoption. Si init échoue ou déroute, l'utilisateur n'ira jamais jusqu'à install.

## User Stories

| ID     | User Story                                                                                                                                        | Points | Priorité | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-006 | As a developer, I want to run a single command to set up the shared docs structure so that I do not have to create files and directories manually | 3      | Must     | ⬜     |
| US-007 | As a developer, I want to choose a custom docs directory name so that it fits my project conventions                                              | 2      | Should   | ⬜     |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Estimation totale

| Métrique            | Valeur                               |
| ------------------- | ------------------------------------ |
| **Stories**         | 2                                    |
| **Points totaux**   | 5                                    |
| **Sprints estimés** | 1 (vélocité estimée : 20 pts/sprint) |

## Critères d'acceptation (niveau epic)

- [ ] aidd init creates the docs directory with templates from the framework
- [ ] A manifest (.aidd/config.json) is created and tracks docs files with hashes
- [ ] Custom docs directory name is persisted in the manifest

## Dépendances

| Dépendance                 | Type      | Bloquant ? |
| -------------------------- | --------- | ---------- |
| Epic: Framework Resolution | Technique | Oui        |

## Spikes associés

| Spike | Objectif | Time-box | Status |
| ----- | -------- | -------- | ------ |
| —     | —        | —        | —      |

---

## Validation

- [x] Justification NSM documentée
- [x] Toutes les stories respectent INVEST
- [x] Acceptance criteria Gherkin pour chaque story
- [x] Estimation totale < 13 points par story
- [x] Dépendances identifiées et plan de mitigation

---

## US-006: "Initialize docs structure"

**As a** developer
**I want** to run a single command to set up the shared docs structure
**So that** I do not have to create files and directories manually

| Estimation | Priorité | Epic                |
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

| Estimation | Priorité | Epic                |
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

> Permettre au développeur de générer les fichiers de configuration spécifiques à chaque outil AI à partir du framework canonique.

## Scope Tier

**MVP**

## Justification NSM

C'est la proposition de valeur principale du CLI. L'installation en une commande est le principal levier d'adoption. Sans distribution fonctionnelle, le produit n'a pas de raison d'exister.

## User Stories

| ID     | User Story                                                                                                                                                          | Points | Priorité | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-008 | As a developer, I want to install the framework for one or more AI tools in a single command so that I do not have to manually create and adapt configuration files | 8      | Must     | ⬜     |
| US-010 | As a developer, I want the CLI to auto-initialize docs if no manifest exists when I run install so that I do not have to remember to run init first                 | 2      | Must     | ⬜     |
| US-011 | As a developer, I want to force-reinstall a tool so that I can regenerate all files from the latest framework version                                               | 2      | Should   | ⬜     |
| US-012 | As a developer, I want the CLI to handle Copilot-specific flattening and VS Code config merging so that Copilot integration works seamlessly                        | 3      | Must     | ⬜     |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Estimation totale

| Métrique            | Valeur                               |
| ------------------- | ------------------------------------ |
| **Stories**         | 4                                    |
| **Points totaux**   | 15                                   |
| **Sprints estimés** | 1 (vélocité estimée : 20 pts/sprint) |

## Critères d'acceptation (niveau epic)

- [ ] aidd install generates correct distributions for Claude, Cursor, and Copilot
- [ ] Content placeholders, frontmatter, and include syntax are correctly rewritten per tool
- [ ] All generated files are tracked in the manifest with correct hashes
- [ ] Copilot flattening handles name collisions with auto-prefix

## Dépendances

| Dépendance                 | Type      | Bloquant ?                 |
| -------------------------- | --------- | -------------------------- |
| Epic: Framework Resolution | Technique | Oui                        |
| Epic: Docs Initialization  | Technique | Non (auto-init handles it) |

## Spikes associés

| Spike                       | Objectif                                                                       | Time-box | Status |
| --------------------------- | ------------------------------------------------------------------------------ | -------- | ------ |
| Copilot flattening strategy | Validate auto-prefix approach on real framework with potential name collisions | 1 jour   | ⬜     |
| VS Code settings.json merge | Validate deep merge strategy for array values (append vs deduplicate)          | 1 jour   | ⬜     |

---

## Validation

- [x] Justification NSM documentée
- [x] Toutes les stories respectent INVEST
- [x] Acceptance criteria Gherkin pour chaque story
- [x] Estimation totale < 13 points par story
- [x] Dépendances identifiées et plan de mitigation

---

## US-008: "Install framework for one or more tools"

**As a** developer
**I want** to install the framework for one or more AI tools in a single command
**So that** I do not have to manually create and adapt configuration files

| Estimation | Priorité | Epic              |
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

| Estimation | Priorité | Epic              |
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

| Estimation | Priorité | Epic              |
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

| Estimation | Priorité | Epic              |
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

> Permettre au développeur de gérer le cycle de vie complet de son installation AIDD : désinstallation d'un outil, vérification de l'état, nettoyage global et diagnostics.

## Scope Tier

**MVP**

## Justification NSM

Les commandes de cycle de vie (uninstall, status, clean, doctor) construisent la confiance. Un développeur qui sait pouvoir désinstaller proprement et diagnostiquer les problèmes adopte le CLI avec moins d'hésitation.

## User Stories

| ID     | User Story                                                                                                                                         | Points | Priorité | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-013 | As a developer, I want to uninstall a tool's configuration without affecting other tools or docs so that I can safely remove tools I no longer use | 3      | Must     | ⬜     |
| US-014 | As a developer, I want to see at a glance which files have drifted from the installed framework version so that I know what has changed            | 5      | Must     | ⬜     |
| US-015 | As a developer, I want to filter status output by tool so that I can focus on a specific tool's drift                                              | 1      | Should   | ⬜     |
| US-016 | As a developer, I want to remove all AIDD traces from my project in a single command so that I can cleanly abandon or reset the installation       | 3      | Must     | ⬜     |
| US-017 | As a developer, I want to run a health check on my installation so that I can detect corrupted manifests, orphaned directories and fix them        | 3      | Must     | ⬜     |
| US-018 | As a developer, I want verbose output on any command so that I can debug framework resolution and file operation issues                            | 2      | Should   | ⬜     |
| US-027 | As a developer, I want to configure CLI defaults in a project settings file so that I do not have to repeat flags on every command                 | 2      | Should   | ⬜     |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Estimation totale

| Métrique            | Valeur                               |
| ------------------- | ------------------------------------ |
| **Stories**         | 7                                    |
| **Points totaux**   | 19                                   |
| **Sprints estimés** | 1 (vélocité estimée : 20 pts/sprint) |

## Critères d'acceptation (niveau epic)

- [ ] Uninstall removes only the target tool's files and updates the manifest
- [ ] Status accurately classifies files as unmodified, modified, deleted, or added
- [ ] Clean removes all AIDD-managed files and the manifest
- [ ] Doctor detects and reports manifest corruption, orphaned directories, and hash mismatches
- [ ] Verbose mode outputs diagnostics to stderr without polluting stdout
- [ ] Settings file (.aidd/settings.json) stores project-level defaults with correct resolution priority

## Dépendances

| Dépendance                | Type      | Bloquant ?                                               |
| ------------------------- | --------- | -------------------------------------------------------- |
| Epic: Tool Distribution   | Technique | Oui (tools must be installed to uninstall/status/doctor) |
| Epic: Docs Initialization | Technique | Oui (manifest must exist)                                |

## Spikes associés

| Spike | Objectif | Time-box | Status |
| ----- | -------- | -------- | ------ |
| —     | —        | —        | —      |

---

## Validation

- [x] Justification NSM documentée
- [x] Toutes les stories respectent INVEST
- [x] Acceptance criteria Gherkin pour chaque story
- [x] Estimation totale < 13 points par story
- [x] Dépendances identifiées et plan de mitigation

---

## US-013: "Uninstall a tool cleanly"

**As a** developer
**I want** to uninstall a tool's configuration without affecting other tools or docs
**So that** I can safely remove tools I no longer use

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

| Estimation | Priorité | Epic                 |
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

> Permettre au développeur de mettre à jour ses distributions installées vers la dernière version du framework et de restaurer des fichiers modifiés à leur version d'origine.

## Scope Tier

**Next Release** (v3.1+)

## Justification NSM

Les mises à jour sont le second levier d'adoption durable. Un utilisateur qui ne peut pas mettre à jour facilement abandonnera le CLI quand le framework évoluera. Promotion conditionnée à adoption > 30%.

## User Stories

| ID     | User Story                                                                                                                                                     | Points | Priorité | Status |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-019 | As a developer, I want to update my installed distributions to the latest framework version so that I benefit from community improvements without manual work  | 5      | Should   | ⬜     |
| US-020 | As a developer, I want the update to detect my local modifications and let me choose whether to keep or overwrite them so that I do not lose my customizations | 5      | Should   | ⬜     |
| US-021 | As a developer, I want to restore specific files to their original framework version so that I can undo accidental changes                                     | 5      | Should   | ⬜     |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Estimation totale

| Métrique            | Valeur                               |
| ------------------- | ------------------------------------ |
| **Stories**         | 3                                    |
| **Points totaux**   | 15                                   |
| **Sprints estimés** | 1 (vélocité estimée : 20 pts/sprint) |

## Critères d'acceptation (niveau epic)

- [ ] Update downloads the latest framework and applies a diff to each installed tool
- [ ] User-modified files are detected and handled interactively (or forced)
- [ ] Restore regenerates files from the pinned framework version
- [ ] Manifest is updated with new hashes and versions after update/restore

## Dépendances

| Dépendance                          | Type      | Bloquant ?                                      |
| ----------------------------------- | --------- | ----------------------------------------------- |
| Epic: Lifecycle Management (status) | Technique | Oui (drift detection needed for update/restore) |
| Community adoption > 30%            | Business  | Oui (promotion trigger)                         |

## Spikes associés

| Spike                | Objectif                                                                                     | Time-box | Status |
| -------------------- | -------------------------------------------------------------------------------------------- | -------- | ------ |
| Update diff strategy | Validate added/removed/changed/unchanged classification on real framework version transition | 1 jour   | ⬜     |

---

## Validation

- [x] Justification NSM documentée
- [x] Toutes les stories respectent INVEST
- [x] Acceptance criteria Gherkin pour chaque story
- [x] Estimation totale < 13 points par story
- [x] Dépendances identifiées et plan de mitigation

---

## US-019: "Update distributions to latest framework"

**As a** developer
**I want** to update my installed distributions to the latest framework version
**So that** I benefit from community improvements without manual work

| Estimation | Priorité | Epic              |
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

| Estimation | Priorité | Epic              |
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

| Estimation | Priorité | Epic              |
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

> Permettre au développeur de propager ses modifications d'un outil vers tous les autres outils installés.

## Scope Tier

**Next Release** (v3.1+)

## Justification NSM

Le sync est le différenciateur pour les utilisateurs multi-outils. Propager un changement fait dans Claude vers Cursor et Copilot en une commande élimine la dernière friction majeure. Promotion conditionnée à l'adoption multi-tool confirmée.

## User Stories

| ID     | User Story                                                                                                                                                  | Points | Priorité | Status |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------ |
| US-023 | As a developer, I want to propagate my changes from one tool to all other installed tools so that my customizations stay consistent across my AI assistants | 5      | Could    | ⬜     |
| US-024 | As a developer, I want the CLI to detect conflicts when the target tool also has modifications so that I do not accidentally overwrite other changes        | 3      | Could    | ⬜     |
| US-025 | As a developer, I want to sync to a specific target tool instead of all so that I can control exactly where changes propagate                               | 2      | Could    | ⬜     |

**Légende** : ⬜ Pending | 🔄 In Progress | ✅ Done | ⏭️ Skipped

## Estimation totale

| Métrique            | Valeur                               |
| ------------------- | ------------------------------------ |
| **Stories**         | 3                                    |
| **Points totaux**   | 10                                   |
| **Sprints estimés** | 1 (vélocité estimée : 20 pts/sprint) |

## Critères d'acceptation (niveau epic)

- [ ] Sync reverse-rewrites source tool content to canonical format, then forward-rewrites to each target
- [ ] Conflicts are detected and reported, not silently overwritten
- [ ] Memory bank files, MCP config, docs, VS Code files, and manifest are never propagated
- [ ] Requires at least 2 installed tools

## Dépendances

| Dépendance                                  | Type      | Bloquant ?              |
| ------------------------------------------- | --------- | ----------------------- |
| Epic: Tool Distribution (content rewriting) | Technique | Oui                     |
| Epic: Lifecycle Management (status)         | Technique | Oui                     |
| Community multi-tool usage confirmation     | Business  | Oui (promotion trigger) |

## Spikes associés

| Spike                       | Objectif                                                                                    | Time-box | Status |
| --------------------------- | ------------------------------------------------------------------------------------------- | -------- | ------ |
| Reverse-rewrite feasibility | Validate that tool-specific content can be losslessly reverse-rewritten to canonical format | 2 jours  | ⬜     |

---

## Validation

- [x] Justification NSM documentée
- [x] Toutes les stories respectent INVEST
- [x] Acceptance criteria Gherkin pour chaque story
- [x] Estimation totale < 13 points par story
- [x] Dépendances identifiées et plan de mitigation

---

## US-023: "Propagate changes across tools"

**As a** developer
**I want** to propagate my changes from one tool to all other installed tools
**So that** my customizations stay consistent across my AI assistants

| Estimation | Priorité | Epic            |
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

| Estimation | Priorité | Epic            |
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

| Estimation | Priorité | Epic            |
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

# Backlog Summary

## Points par epic

| Epic                 | Scope | Stories | Points | Sprints |
| -------------------- | ----- | ------- | ------ | ------- |
| Framework Resolution | MVP   | 6       | 17     | 1       |
| Docs Initialization  | MVP   | 2       | 5      | < 1     |
| Tool Distribution    | MVP   | 4       | 15     | 1       |
| Lifecycle Management | MVP   | 7       | 19     | 1       |
| Framework Updates    | v3.1+ | 3       | 15     | 1       |
| Cross-Tool Sync      | v3.1+ | 3       | 10     | < 1     |
| **Total**            |       | **25**  | **81** | **~4**  |

## MVP Breakdown

| Métrique                | Valeur                       |
| ----------------------- | ---------------------------- |
| **Stories MVP**         | 19                           |
| **Points MVP**          | 56                           |
| **Sprints MVP estimés** | 3 (vélocité : 20 pts/sprint) |

## v3.1+ Breakdown

| Métrique                  | Valeur                       |
| ------------------------- | ---------------------------- |
| **Stories v3.1+**         | 6                            |
| **Points v3.1+**          | 25                           |
| **Sprints v3.1+ estimés** | 2 (vélocité : 20 pts/sprint) |

---

# Definition of Done

> Critères de qualité applicables à **toutes** les user stories du projet. Une story n'est "done" que si **tous** ces critères sont satisfaits.

## Critères standard

| #   | Critère                 | Description                                                               | Vérifié par |
| --- | ----------------------- | ------------------------------------------------------------------------- | ----------- |
| 1   | **Acceptance criteria** | Tous les scénarios Gherkin de la story passent                            | PM / QA     |
| 2   | **Code review**         | Le code a été revu et approuvé par au moins 1 pair                        | Dev         |
| 3   | **Tests**               | Tests unitaires et/ou E2E écrits et passants                              | Dev / QA    |
| 4   | **Documentation**       | Documentation technique mise à jour si nécessaire                         | Dev         |
| 5   | **Déploiement**         | La story passe `pnpm validate` et un smoke test manuel sur un projet réel | Dev         |

## Critères spécifiques au projet

| #   | Critère                | Description                                                                                                        | Vérifié par    |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------- |
| 6   | **Zero data loss**     | L'opération ne supprime jamais de fichier non suivi par le manifest sauf action explicite de l'utilisateur         | Dev / QA       |
| 7   | **Performance**        | Les opérations locales s'exécutent en < 5 secondes pour un framework standard (~100 fichiers)                      | Dev            |
| 8   | **Error messages**     | Chaque erreur inclut un message actionnable indiquant comment résoudre le problème                                 | Dev / QA       |
| 9   | **Token security**     | Aucun token d'authentification n'est écrit sur disque, loggé en stdout/stderr ou inclus dans les messages d'erreur | Dev / Security |
| 10  | **Cross-platform**     | La story fonctionne sur macOS, Linux et WSL                                                                        | Dev / QA       |
| 11  | **Clean Architecture** | Le domain layer n'a aucun import d'infrastructure                                                                  | Dev            |
| 12  | **Dependency limit**   | Maximum 2 dépendances runtime directes respecté                                                                    | Dev            |
| 13  | **Manifest compat**    | Si le format du manifest change, la migration automatique des installations existantes est implémentée             | Dev            |
| 14  | **No hardcoded paths** | Le domain layer utilise le framework descriptor, jamais de chemins en dur (agents/, commands/, etc.)               | Dev            |

## Exceptions

| Type de story | Critères ajustés                     | Raison                              |
| ------------- | ------------------------------------ | ----------------------------------- |
| **Spike**     | Pas de tests, livrable = rapport     | Investigation, pas d'implémentation |
| **Prototype** | Pas de code review, pas de tests E2E | Jetable par design                  |

---

## Validation

- [ ] DoD validée par l'équipe (PM + Dev Lead + QA)
- [ ] Critères mesurables et vérifiables
- [ ] Exceptions documentées et limitées
- [ ] DoD accessible à toute l'équipe
