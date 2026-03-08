---
id: 043
milestone: M4
title: "Implement DoctorUseCase and doctor command"
stories: [US-017]
points: 3
blockedBy: [042]
---

# 043: Implement DoctorUseCase and doctor command

## Context
The doctor command runs a health check on the installation. It validates the manifest structure, checks file existence and hash integrity, detects orphaned directories, and reports actionable fixes.

## Scope
Implement DoctorUseCase and the doctor command with full diagnostics.

## Acceptance Criteria
- [ ] Healthy installation: reports "Installation is healthy" with file counts per tool and docs
- [ ] Hash mismatch: reports corrupted files with paths
- [ ] Missing tracked file: reports missing files
- [ ] Orphaned directory: detects tool directories (e.g., `.windsurf/`) not tracked in manifest
- [ ] Corrupted manifest JSON: reports "Manifest is corrupted (invalid JSON)" with fix suggestion
- [ ] No manifest: reports "AIDD is not initialized. Run aidd init to get started."
- [ ] Each issue has an actionable fix suggestion
- [ ] Summary: total issues found, severity (info/warning/error)

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.doctor.*`, `success.doctor.healthy`, `empty.doctor.not_initialized`, `progress.doctor.checking`, `doctor.issue.*` (missing_file, hash_mismatch, orphaned_dir, manifest_structure), `doctor.fix.*` (missing_file, hash_mismatch, orphaned_dir, manifest_structure), `help.doctor.description`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.7 for doctor flow state table and recovery paths.
- DoctorUseCase: load manifest (catch JSON errors) -> validate structure -> for each tracked file: check existence + hash -> scan for orphaned directories -> report.
- Orphaned directory detection: check for known tool directory patterns (`.claude/`, `.cursor/`, `.github/`) that exist on disk but have no manifest entry.
- Fix suggestions: "Run `aidd install claude --force` to regenerate corrupted files", "Run `aidd clean --force` and re-initialize".

## Files to Create/Modify
- `src/application/use-cases/doctor-use-case.ts` -- DoctorUseCase
- `src/presentation/commands/doctor.ts` -- commander registration
- `tests/application/use-cases/doctor-use-case.test.ts` -- unit tests
- `tests/presentation/commands/doctor.test.ts` -- command tests

## Tests
- Healthy installation: all clear
- Hash mismatch detected and reported
- Missing file detected and reported
- Orphaned directory detected
- Corrupted manifest JSON handled
- No manifest: guidance message
- Multiple issues reported with individual fix suggestions

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
