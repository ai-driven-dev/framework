# Coding Conventions

## Naming Convention

- **Files & Folders**: lowercase kebab-case everywhere (`domain/plugins/claude-code-config.ts`, `infra/fs/file-system-adapter.ts`).
  - Keep suffixes meaningful (`*.service.ts,*.policy.ts`, `*.controller.ts,*.e2e.test.ts`).
- **Tests**: colocate with source using the same kebab-case + `.test.ts` or `.e2e.test.ts` (`install-package.e2e.test.ts`).
- **Classes/Interfaces**: PascalCase for classes (`DisplayService`), I prefix for formal interfaces (`IInstallationPolicy`).
- **Functions/Variables**: camelCase for everything inside modules; module-level constants shared across files go UPPER_SNAKE (`DEFAULT_DOCS_DIR`).
- **Enums**: PascalCase enum names, UPPER_SNAKE members.
- **Assets/Scripts**: keep filenames descriptive and kebab-case (`tree.sh`, `aidd-docs.sh`, `finish.mp3`).

## Code style

- Language: TypeScript (ES2022 target, ESNext modules, strict mode enabled).
- Exports: use named exports; avoid default exports.
- Imports: resolve via relative paths within the layer; keep `app → domain → infra` direction.

## Coding rules

- Logging: never call `console.*` directly—use `DisplayService` for user-facing output.
- Error handling: throw descriptive `Error` objects or return structured results; **no silent failures**.
- No backward compatibility needed; refactor freely.

## Tech Patterns

- All policies depend on the `InstallationPolicy` contract and receive a `FileSystemAdapter` + `DisplayAdapter`.
- Constants:
  - Paths → `infra/constants/paths.ts`
  - Messages/prompts → `domain/constants/messages.ts`
  - App metadata → `app/constants/appInfo.ts`
- When adding new commands/plugins:
  1. Extend domain types (`ComponentSelection`, `PluginConfig`).
  2. Wire infra dependencies inside `createInstaller`.
  3. Update documentation + roadmap checkboxes.
