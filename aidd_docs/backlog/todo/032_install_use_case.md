---
id: 032
milestone: M3
title: "Implement InstallUseCase core logic"
stories: [US-008]
points: 8
blockedBy: [031]
---

# 032: Implement InstallUseCase core logic

## Context
The install use case is the core value proposition of the CLI. It checks the manifest, resolves the framework, generates tool-specific distributions, writes files to disk, and updates the manifest. This ticket covers the core logic; wiring to the CLI command is in ticket 033.

## Scope
Implement InstallUseCase with distribution generation for all three tools, content rewriting verification, and manifest updating.

## Acceptance Criteria
- [ ] `InstallUseCase.execute(toolIds: ToolId[], options)` generates distributions for specified tools
- [ ] For each tool: calls `Distribution.generate()` with the framework, ToolSpec, and docsDir
- [ ] For each tool: writes all GeneratedFile entries to disk via FileSystem port
- [ ] For each tool: adds tool entry to manifest with framework version and file hashes
- [ ] Already-installed tool without `--force`: skips with message "claude is already installed. Use --force to reinstall."
- [ ] Content placeholders (`{{TOOLS}}/`, `{{DOCS}}/`) are rewritten per tool
- [ ] Frontmatter is converted per tool format (paths, globs/alwaysApply, applyTo)
- [ ] Include syntax is converted per tool (`@path` for Claude/Cursor, markdown links for Copilot)
- [ ] Install with no tool IDs: throws error "At least one tool ID is required. Valid tools: claude, cursor, copilot"
- [ ] Install with invalid tool ID: throws error "Unknown tool: invalid-tool. Valid tools: claude, cursor, copilot"
- [ ] Manifest is saved after all tools are processed (atomic update)
- [ ] Result includes list of generated files per tool and total count

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.install.*`, `success.install`, `success.install.multi`, `progress.install.generating`, `help.install.description`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.3 for install flow state table and recovery paths.
- InstallUseCase receives ports via constructor injection (FrameworkResolver, FrameworkLoader, FileSystem, ManifestRepository, Hasher, Logger).
- `ToolId` is defined in `src/domain/models/tool-id.ts` (not `tool-spec.ts`). Import from there.
- ToolSpec instances are resolved from ToolId via a factory or registry.
- Distribution.generate() produces GeneratedFile[] that the use case writes via FileSystem.
- The `--force` flag is passed as a boolean option.
- Memory bank, MCP config, and VS Code config are handled as special GeneratedFile entries.

## Files to Create/Modify
- `src/application/use-cases/install-use-case.ts` -- InstallUseCase
- `tests/application/use-cases/install-use-case.test.ts` -- unit tests with mocked ports

## Tests
- Install single tool: generates correct files and updates manifest
- Install multiple tools: generates files for all and updates manifest
- Install already-installed tool without force: skips
- Install with no tool IDs: throws error
- Install with invalid tool ID: throws error
- Content rewriting verified by hash comparison against expected output
- Frontmatter conversion verified for all three tools
- Manifest contains correct entries after install

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
