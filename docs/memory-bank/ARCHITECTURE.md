# Project Scope

- This file applies specifically to `cli/`, the TypeScript CLI that installs and configures the AI-Driven Development (AIDD) framework.
- Root folder in `../` contains whole AIDD framework monorepo with documentation, slides, prompts templates etc.

## Available Commands

All scripts are mapped inside `cli/package.json`:

```json
@package.json
```

## Architecture

- No module imports "up" the layers (infra → domain → app).
- `app/`: CLI entrypoints, prompt service, installers, and presentation adapters.
- `domain/`: Business rules, plugin catalog/configs, policies, registries, worktree logic, and pure utilities.
- `infra/`: File system, git, process, shell, asset, and platform adapters plus shared constants.

### Outside of `src/`

- `assets/`: Bundled runtime resources (audio cues, documentation templates, CLI scripts) that live outside `src/` and are copied into the distribution at build time.

### Whole structure

```text
@cli/docs/cli-tree.txt
```

### App Layer (`app/`)

- `commands/` → Thin Commander handlers (`install`, `worktree`).
- `install/` → Prompt service, installer factory, configuration utilities.
- `ui/` → Display adapters injected everywhere.
- **Rules**
  - No direct Node APIs; everything goes through domain/infra collaborators.
  - Keep functions <100 LOC; extract orchestration helpers when needed.
  - Import **downstream only** (`domain/*`, `infra/*`).

### Domain Layer (`domain/`)

- `install/` → `PluginCatalog`, component selections, prompt metadata, config contracts.
- `policies/` → Policy contracts + concrete implementations (core, system, IDE, dev-tools).
- `plugins/` → Plugin configs referencing policy IDs and declarative operations.
- `registry/` → Policy/plugin registries.
- `worktree/` → Worktree session + command result types.
- `constants/` → Pure data (messages, sections) that both app + domain can reuse.
- **Rules**
  - Never import from `app/*`.
  - Only depend on `infra/*` through interfaces passed in from the app layer.
  - Keep everything deterministic and side-effect free apart from injected adapters.

### Infra Layer (`infra/`)

- `fs/` → `FileSystemAdapter`, `CopyManager`, `SymlinkManager`.
- `assets/` → `AssetLocator`.
- `config/` → `AssetValidator`, `EnvironmentValidator`, `assetPaths`.
- `constants/` → Shared `PATHS`, `DOCS_DIRECTORIES`, error templates.
- `utils/` → OS/platform helpers (`isGitSubmodule`, directory copy fallback).
- `git/`, `shell/`, `process/` → External process + git wrappers.
- **Rules**
  - Zero imports from `app/` or `domain/`.
  - Keep modules focused; prefer small helpers over monolithic adapters.
