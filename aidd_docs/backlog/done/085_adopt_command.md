---
id: 085
milestone: M9
title: "aidd adopt — migrate manual installation to CLI-managed state"
stories: [US-028]
points: 5
blockedBy: []
---

## Context

Many users installed the AIDD framework manually by following documentation before the CLI was available. When they try to run `aidd init`, the CLI fails with "directory already exists". The `aidd adopt` command bridges this gap: it detects existing files, downloads the latest framework, normalizes files to the framework format, handles conflicts like `update`, and creates the manifest.

## Scope

- New `aidd adopt` command
- Guard in `aidd init` that detects existing AIDD files and redirects to `adopt`
- Same conflict handling as `update` (keep/overwrite prompt + backup)
- Files on disk not in the framework distribution → doctor-style warning, not touched

## Acceptance Criteria

- [ ] `aidd init` on a project with existing `.aidd/`, `aidd_docs/`, `.claude/`, `.cursor/` or `.github/` blocks with message: "AIDD files detected. Use `aidd adopt` to migrate your existing installation."
- [ ] `aidd adopt` auto-detects installed tools from existing directories (`.claude/` → claude, `.cursor/` → cursor, `.github/` → copilot)
- [ ] `aidd adopt` downloads the latest framework (or `--release <tag>` if specified)
- [ ] Each file in the distribution that exists on disk → conflict candidate → prompt keep/overwrite
- [ ] If user chooses overwrite → existing file backed up as `<path>.backup` before being replaced
- [ ] `aidd adopt --force` overwrites all files without prompting
- [ ] Files on disk not in framework distribution → warning logged, not touched
- [ ] Manifest created at `.aidd/manifest.json` with post-write hashes
- [ ] Final output summarizes: files written, files kept, backups created, orphan warnings
- [ ] `aidd status` after `aidd adopt` reports all tracked files as in-sync
- [ ] E2E test: manually-placed framework files → `aidd adopt` → manifest created → `aidd status` clean

## Technical Notes

- Reuse `UpdateUseCase` conflict logic (keep/overwrite/backup flow)
- No manifest exists at entry point → treat every on-disk file as conflict candidate (no prior hash)
- Tool auto-detection: check directory existence for each known tool config (`getToolConfig`)
- `aidd_docs/` handling: if it already exists, adopt it as-is (no re-copy of templates)
- `docsDir` default: use manifest default (`aidd_docs`) since no existing manifest

## Files to Create/Modify

- `src/application/use-cases/adopt-use-case.ts` (create)
- `src/application/commands/adopt.ts` (create)
- `src/cli.ts` (register adopt command)
- `src/application/use-cases/init-use-case.ts` (add guard for existing files)
- `tests/application/use-cases/adopt-use-case.test.ts` (create)
- `tests/e2e/adopt.e2e.test.ts` (create)

## Tests

- Unit: adopt-use-case — no existing files (error), all new files, all conflicts (keep), all conflicts (overwrite), mixed, orphan files warning
- E2E: manually seeded project → `aidd adopt` → manifest present → `aidd status` clean

## Done When

- All acceptance criteria checked
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm lint` passes
