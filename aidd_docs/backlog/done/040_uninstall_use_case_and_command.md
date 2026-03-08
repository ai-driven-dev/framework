---
id: 040
milestone: M4
title: "Implement UninstallUseCase and uninstall command"
stories: [US-013]
points: 3
blockedBy: [034]
---

# 040: Implement UninstallUseCase and uninstall command

## Context
The uninstall command removes a tool's generated files without affecting other tools or docs. It deletes only manifest-tracked files, cleans empty directories, and updates the manifest.

## Scope
Implement UninstallUseCase (application layer) and the uninstall command (presentation layer).

## Acceptance Criteria
- [ ] `aidd uninstall <tools...>` removes all files tracked by the manifest for the specified tools
- [ ] Empty directories left behind are cleaned up
- [ ] Manifest is updated to remove the tool entries; other tools and docs are preserved
- [ ] Manifest and `.aidd/` directory remain even if no tools are left (only `clean` removes them)
- [ ] `aidd uninstall claude cursor` removes both tools in one command
- [ ] Uninstalling a non-installed tool: fails with "cursor is not installed"
- [ ] Some tracked files already manually deleted: skips missing files, removes the rest
- [ ] No manifest exists: fails with "No AIDD installation found. Run aidd init first."
- [ ] Success output: lists removed files and summary

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.uninstall.*`, `success.uninstall`, `success.uninstall.multi`, `progress.uninstall.removing`, `help.uninstall.description`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.4 for uninstall flow state table and recovery paths.
- UninstallUseCase: load manifest -> validate tool is installed -> delete files via FileSystem -> deleteEmptyDirectories -> removeTool from manifest -> save manifest.
- Only manifest-tracked files are deleted. Untracked user files in tool directories are preserved.
- After uninstalling all tools, the docs and manifest remain. The user must run `clean` to fully remove.

## Files to Create/Modify
- `src/application/use-cases/uninstall-use-case.ts` -- UninstallUseCase
- `src/presentation/commands/uninstall.ts` -- commander registration
- `tests/application/use-cases/uninstall-use-case.test.ts` -- unit tests
- `tests/presentation/commands/uninstall.test.ts` -- command tests

## Tests
- Uninstall single tool: files deleted, manifest updated
- Uninstall multiple tools: all files deleted, manifest updated
- Uninstall non-installed tool: error
- Already-deleted files: skipped gracefully
- Empty directories cleaned
- Other tools and docs untouched
- No manifest: error with guidance

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
