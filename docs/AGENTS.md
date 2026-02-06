---
name: agents
description: AI agent configuration and guidelines
---

# AGENTS.md

> IMPORTANT: On first conversation message, say "AI-Driven Development ON - Date: {current_date}, TZ: {current_timezone}." to User.

This file contains a collection of config, context, rules, information etc for a project.

The goal is to provide to the ASSISTANT a clear understanding of the project's context, including its structure, dependencies, and any specific conventions that should be followed.

All instructions and information above are willing to be up to date, but always remind yourself that USER can be wrong, be critical of the information provided, and verify it against the project's actual state.

## Roles

- **USER**: The human developer interacting with the AI assistant, providing instructions, feedback, and context about the project.
- **ASSISTANT**: The AI assistant (you) that helps the USER as a senior software engineer. You do orchestrate the development process, ensuring that the code is clean, efficient, and adheres to best practices. Delegate tasks to specialized agents when necessary.

## Important context

- Current date and timezone: !`date +%Y-%m-%d +%Z`
  - The user's timezone and date are defined {current_date} + {current_timezone}, use them for any date-related task.
  - Any dates before this are in the past, and any dates after this are in the   future. When the user asks for the 'latest', 'most recent', 'today's', etc.
- Don't assume your knowledge is up to date.

## Mandatory Rules

- **Avoid complexity**: stay simple, pragmatic, effective
- When dealing with github, use `gh` cli
- **No over-engineering**: focus on requirements
- **No silent error**, throw exceptions early
- **No extra feature**, focus only on core functionality
- Always write code that match versions

### Code Quality Standards

- Eliminate duplication ruthlessly
- Express intent clearly through naming and structure
- Make dependencies explicit
- Keep methods small and focused on a single responsibility
- Minimize state and side effects

### Searching

- Use `rg` for searching (if available)
- Avoid `python` script calls (unless absolutely necessary)

### Refactoring Guidelines

- Preserve the intent
- Avoid comments on obvious code, make code self-explanatory instead
- Only add code comments when tricky logic is involved

### Testing Guidelines

- Always write tests first for bug fixes
- When testing: never mock functional components

## Answering Guidelines

- Be 100% sure of your answers.
- If unsure, say "I don't know" or ask for clarification.
- Never say "you are right!", prefer anticipating mistakes.

## PROJECT OVERVIEW

```markdown
@README.md
```

## MEMORY BANK

This section contains project-specific memory bank information, including context, architecture decisions, and implementation details.

The goal is to provide the ASSISTANT with a comprehensive understanding of the project's current state, past decisions, and ongoing context.

All information should be kept up to date and reflect the actual state of the project.
### Project Scope

- This file applies specifically to `cli/`, the TypeScript CLI that installs and configures the AI-Driven Development (AIDD) framework.
- Root folder in `../` contains whole AIDD framework monorepo with documentation, slides, prompts templates etc.

#### Available Commands

All scripts are mapped inside `cli/package.json`:

```json
@package.json
```

#### Architecture

- No module imports "up" the layers (infra → domain → app).
- `app/`: CLI entrypoints, prompt service, installers, and presentation adapters.
- `domain/`: Business rules, plugin catalog/configs, policies, registries, worktree logic, and pure utilities.
- `infra/`: File system, git, process, shell, asset, and platform adapters plus shared constants.

##### Outside of `src/`

- `assets/`: Bundled runtime resources (audio cues, documentation templates, CLI scripts) that live outside `src/` and are copied into the distribution at build time.

##### Whole structure

```text
@cli/docs/cli-tree.txt
```

##### App Layer (`app/`)

- `commands/` → Thin Commander handlers (`install`, `worktree`).
- `install/` → Prompt service, installer factory, configuration utilities.
- `ui/` → Display adapters injected everywhere.
- **Rules**
  - No direct Node APIs; everything goes through domain/infra collaborators.
  - Keep functions <100 LOC; extract orchestration helpers when needed.
  - Import **downstream only** (`domain/*`, `infra/*`).

##### Domain Layer (`domain/`)

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

##### Infra Layer (`infra/`)

- `fs/` → `FileSystemAdapter`, `CopyManager`, `SymlinkManager`.
- `assets/` → `AssetLocator`.
- `config/` → `AssetValidator`, `EnvironmentValidator`, `assetPaths`.
- `constants/` → Shared `PATHS`, `DOCS_DIRECTORIES`, error templates.
- `utils/` → OS/platform helpers (`isGitSubmodule`, directory copy fallback).
- `git/`, `shell/`, `process/` → External process + git wrappers.
- **Rules**
  - Zero imports from `app/` or `domain/`.
  - Keep modules focused; prefer small helpers over monolithic adapters.


### Coding Guidelines

> Those rules must be minimal because the MUST be checked after EVERY CODE GENERATION.

#### Requirements to complete a feature

**A feature is really completed if ALL of the above are satisfied: if not, iterate to fix all until all are green.**

#### Steps to follow

1. Check there is no duplication
2. Ensure code is re-used
3. Run all those commands, in order to ensure code is perfect:

| Order | Command                           | Description                              |
|-------|-----------------------------------|------------------------------------------|
| 1     | `pnpm run typecheck`              | TypeScript strict compilation check      |
| 2     | `pnpm run lint`                   | Biome linter check                       |
| 3     | `pnpm run knip:production`        | Unused code detection (production deps)  |
| 4     | `pnpm run jscpd`                  | Code duplication detection               |
| 5     | `pnpm run format`                 | Biome auto-formatting                    |
| 6     | `pnpm test`                       | Full E2E test suite with build           |
| 7     | `pnpm run build`                  | Production build via tsup                |
| 8     | `lefthook run pre-commit --force` | Run all pre-commit hooks                 |

#### Success Criteria

- ✅ All commands above pass without errors
- ✅ No TypeScript errors
- ✅ No linting issues
- ✅ No unused code/dependencies
- ✅ No code duplication
- ✅ Code properly formatted
- ✅ All tests passing
- ✅ Production build successful
- ✅ All hooks passing

### Coding Conventions

#### Naming Convention

- **Files & Folders**: lowercase kebab-case everywhere (`domain/plugins/claude-code-config.ts`, `infra/fs/file-system-adapter.ts`).
  - Keep suffixes meaningful (`*.service.ts,*.policy.ts`, `*.controller.ts,*.e2e.test.ts`).
- **Tests**: colocate with source using the same kebab-case + `.test.ts` or `.e2e.test.ts` (`install-package.e2e.test.ts`).
- **Classes/Interfaces**: PascalCase for classes (`DisplayService`), I prefix for formal interfaces (`IInstallationPolicy`).
- **Functions/Variables**: camelCase for everything inside modules; module-level constants shared across files go UPPER_SNAKE (`DEFAULT_DOCS_DIR`).
- **Enums**: PascalCase enum names, UPPER_SNAKE members.
- **Assets/Scripts**: keep filenames descriptive and kebab-case (`tree.sh`, `aidd-docs.sh`, `finish.mp3`).

#### Code style

- Language: TypeScript (ES2022 target, ESNext modules, strict mode enabled).
- Exports: use named exports; avoid default exports.
- Imports: resolve via relative paths within the layer; keep `app → domain → infra` direction.

#### Coding rules

- Logging: never call `console.*` directly—use `DisplayService` for user-facing output.
- Error handling: throw descriptive `Error` objects or return structured results; **no silent failures**.
- No backward compatibility needed; refactor freely.

#### Tech Patterns

- All policies depend on the `InstallationPolicy` contract and receive a `FileSystemAdapter` + `DisplayAdapter`.
- Constants:
  - Paths → `infra/constants/paths.ts`
  - Messages/prompts → `domain/constants/messages.ts`
  - App metadata → `app/constants/appInfo.ts`
- When adding new commands/plugins:
  1. Extend domain types (`ComponentSelection`, `PluginConfig`).
  2. Wire infra dependencies inside `createInstaller`.
  3. Update documentation + roadmap checkboxes.


### Testing Guidelines

This document outlines the testing strategies and guidelines for the project.

**Mandatory rules:**

- E2E tests covering 100% of the feature
- **No mocks** (real files, real filesystem)
- Tests in `src/__tests__/`

#### Tools and Frameworks

- **Vitest** - Test runner
- **Node.js Test Fixtures** - Isolated test environments in `output-tests/`

#### Testing Strategy

- **Behavior-Driven** - Test behaviors, not implementations
- **No mocking** - Use real implementations
- **Minimal approach** - Fewer tests that cover more ground

##### Types of Tests

- **Unit Tests** (`*.test.ts`) - Single function/class behavior
- **E2E Tests** (`*.e2e.test.ts`) - Full installation flows with real filesystem

#### Decoupling Rules

- Never couple tests to specific IDEs, plugins, or external tools
- Test the contract/interface, not the concrete implementation
- Use generic assertions over specific values when possible

#### Naming Conventions

- Describe the behavior: `"returns plugins when servers selected"`
- Avoid implementation details in test names
- No `"should"` prefix needed

#### Assertions

Prefer behavioral assertions:

| Prefer               | Avoid         |
| -------------------- | ------------- |
| `toBeTruthy()`       | `toBe(true)`  |
| `toBeFalsy()`        | `toBe(false)` |
| `toHaveLength(0)`    | `toEqual([])` |
| `toBeGreaterThan(0)` | `toBe(3)`     |

#### What to Test

- Edge cases (empty inputs, undefined, null)
- Happy path (main use case)
- Error conditions

#### What NOT to Test

- Each IDE/plugin individually (creates coupling)
- Internal private methods
- Implementation details that may change

#### Rules for writing tests

- Never skip any tests.
- Never mock.
- Never use `jscpd:ignore-start` or similar to bypass duplication checks.
- Avoid `any` type; prefer `unknown` + type guards.
- Do not use `ts-ignore`, always ask me before bypassing type checks.