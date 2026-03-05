---
id: 031
milestone: M3
title: "Implement InitUseCase and init command"
stories: [US-006, US-007]
points: 5
blockedBy: [030]
---

# 031: Implement InitUseCase and init command

## Context
The `aidd init` command is the entry point for new users. It resolves the framework, copies docs templates to the project, hashes them, and creates the manifest. It supports a custom docs directory name.

## Scope
Implement InitUseCase (application layer) and the init command (presentation layer) with full support for US-006 and US-007.

## Acceptance Criteria
- [ ] `aidd init` creates `aidd_docs/` with documentation templates from the framework
- [ ] `aidd init` creates `.aidd/config.json` manifest tracking docs files with their hashes
- [ ] `aidd init --docs-dir my_docs` uses custom name and stores `"docsDir": "my_docs"` in manifest
- [ ] Default docs dir name (`aidd_docs`) is NOT stored in manifest (omitted when default)
- [ ] `aidd init` when `aidd_docs/` already exists: fails with "aidd_docs/ already exists. Use a different directory name or remove it first."
- [ ] `aidd init` when `.aidd/` exists but no `config.json`: proceeds with initialization, creates manifest
- [ ] `aidd init --docs-dir "../escape"`: fails with error rejecting invalid directory name
- [ ] Success output: reports list of created files
- [ ] Framework resolution uses global options (`--repo`, `--token`, settings)
- [ ] **InitUseCase** orchestrates: resolve framework -> load descriptor -> copy templates -> hash -> create manifest

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.init.*`, `success.init`, `help.init.description`, `help.opt.docs_dir`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.2 for init flow state table and recovery paths.
- InitUseCase is in `src/application/use-cases/init-use-case.ts`.
- Templates come from `FrameworkDescriptor.templates` (memoryBank, docsReadme, etc.).
- Docs files are raw copies, NOT tool-specific rewrites (no Distribution involved).
- The manifest tracks docs files in a DocsEntry with version and file hashes.
- Invalid docs dir names: reject paths with `..`, absolute paths, or special characters.

## Files to Create/Modify
- `src/application/use-cases/init-use-case.ts` -- InitUseCase
- `src/presentation/commands/init.ts` -- commander registration for `aidd init`
- `tests/application/use-cases/init-use-case.test.ts` -- unit tests with mocked ports
- `tests/presentation/commands/init.test.ts` -- command integration tests

## Tests
- InitUseCase creates docs directory and manifest
- InitUseCase with custom docs dir stores it in manifest
- InitUseCase fails when docs dir already exists
- InitUseCase proceeds when .aidd exists without config.json
- Invalid docs dir name rejected
- Init command wires global options correctly

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
