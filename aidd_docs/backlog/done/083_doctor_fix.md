---
id: 083
milestone: M8
title: "Add --fix flag to aidd doctor for auto-remediation"
stories: []
points: 3
blockedBy: []
---

# 083: Add --fix flag to aidd doctor for auto-remediation

## Context

`aidd doctor` reports issues with suggested fix commands printed as text. Users must read each suggestion and run them manually. For CI pipelines that want a "check and auto-repair" step, this is insufficient.

`aidd doctor --fix` auto-executes the appropriate remediation for each detectable issue. Issues that require destructive or ambiguous operations (corrupted manifest, orphaned directories) are skipped with guidance — they are never auto-fixed.

## Scope

Add `--fix` flag to `DoctorUseCase` and the doctor command. Auto-fix only safe, reversible issues. Report what was fixed and what was skipped.

## Acceptance Criteria

- [ ] `aidd doctor --fix` runs the full health check then auto-fixes eligible issues
- [ ] **Missing file** (tracked in manifest, not on disk): auto-runs `install --force` for the affected tool
- [ ] **Hash mismatch** (file modified): NOT auto-fixed — drift is intentional by design. Reported with `restore` guidance (v3.1+) or `install --force` as fallback
- [ ] **Orphaned directory** (tool dir exists, not in manifest): NOT auto-fixed — could contain user files. Reported with manual cleanup guidance
- [ ] **Corrupted manifest**: NOT auto-fixed — requires destructive clean. Error is surfaced with `aidd clean --force` guidance
- [ ] Summary: "Fixed {fixedCount} issue(s). {skippedCount} issue(s) require manual action."
- [ ] If no issues found: existing "Installation is healthy" message unchanged
- [ ] Exit code: 0 if all issues fixed or no issues. 1 if any issues remain after fix (same CI composability contract as `aidd doctor`)
- [ ] `--fix` without prior init: fails with "No AIDD installation found. Run `aidd init` first."

## Technical Notes

- **UX Copy source of truth**: use keys `doctor.fix.*` and new `progress.doctor.fixing` and `success.doctor.fixed` (section to be added to `ux_copy.md`).
- `DoctorUseCase` returns a list of issues with a `fixable: boolean` field on each. Currently issues are only formatted in the command layer. Add `fixable: 'install-force' | 'none'` discrimination to the issue type.
- Auto-fix for missing files: call `InstallUseCase` with `force: true` scoped to the affected tool. This requires `InstallUseCase` to be injectable into `DoctorUseCase` — or handled at the command level by running a sub-command after doctor report.
- Prefer command-level orchestration: command calls `DoctorUseCase.execute()` to get issues, then calls `InstallUseCase.execute({tools: [toolId], force: true})` for each fixable issue. Cleaner dependency graph, no circular use-case references.
- Framework must be resolvable for the install sub-call: `--framework`, `--repo`, `--token` global options must be passed through to the install sub-call when `--fix` is active.

## Files to Create/Modify

- `src/domain/models/doctor-report.ts` (or equivalent issue type) — add `fixable: 'install-force' | 'none'` to issue discriminant
- `src/application/use-cases/doctor-use-case.ts` — emit `fixable` field on issues
- `src/application/commands/doctor.ts` — add `--fix` flag, orchestrate fix loop using `InstallUseCase`
- `tests/application/use-cases/doctor-use-case.test.ts` — add `fixable` field to issue assertions
- `tests/e2e/doctor.e2e.test.ts` — add `--fix` E2E scenarios

## Tests

- `doctor --fix` with missing file: install --force runs, file restored, reported as fixed
- `doctor --fix` with hash mismatch: issue reported as not auto-fixable, exit 1
- `doctor --fix` with orphaned directory: reported as not auto-fixable, exit 1
- `doctor --fix` with no issues: "Installation is healthy" message, exit 0
- `doctor --fix` mixed (missing + mismatch): missing file fixed, mismatch skipped, exit 1
- Exit code 0 when all issues resolved, 1 when any remain

## Done When

- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
