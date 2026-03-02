---
id: 061
milestone: M6
title: "Implement conflict handling during update with interactive prompts"
stories: [US-020]
points: 5
blockedBy: [060]
---

# 061: Implement conflict handling during update with interactive prompts

## Context
When updating, the user may have modified files locally. If the framework also changed those files, a conflict exists. The CLI must detect these conflicts and let the user choose per-file: keep their version or accept the framework update. The `--force` flag bypasses prompting.

## Scope
Implement ConflictSet classification in UpdateUseCase, wire PrompterAdapter with @inquirer/prompts, and add interactive per-file resolution.

## Acceptance Criteria
- [ ] Update detects user-modified files: disk hash differs from manifest hash
- [ ] For each file: classifies as unchanged (disk=manifest), user-modified (disk!=manifest, new=manifest), framework-updated (disk=manifest, new!=manifest), both-modified (disk!=manifest, new!=manifest)
- [ ] User-modified + framework-updated (conflict): prompts "keep" or "overwrite" per file
- [ ] User-modified + framework-unchanged: no conflict, user version preserved
- [ ] Framework-updated + user-unchanged: auto-apply framework update
- [ ] `--force` overwrites all user-modified files without prompting
- [ ] PrompterAdapter with @inquirer/prompts for interactive prompts (confirm/select)
- [ ] SilentPrompterAdapter used when `--force` is set
- [ ] Manifest reflects actual state after resolutions (kept user hash or new framework hash)

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `prompt.update.*` (file_modified, choice, option_keep, option_overwrite, option_diff, summary).
- `ConflictSet.applyResolutions()` does NOT exist in the codebase — it was removed as YAGNI in M1 refactor pass 2. This ticket must CREATE it from scratch alongside its tests.
- ConflictSet.classify() from domain (ticket 016 stubs) now gets full implementation.
- PrompterAdapter: first real use of @inquirer/prompts. Import `confirm` and `select` from `@inquirer/prompts`.
- Classification uses 3 hashes: manifestHash (last known), diskHash (current on disk), newHash (from new distribution).
- When user keeps their version: manifest hash stays as diskHash. When they accept framework: file overwritten, manifest gets newHash.

## Files to Create/Modify
- `src/domain/models/conflict-set.ts` -- full implementation (replace stubs)
- `src/infrastructure/adapters/prompter-adapter.ts` -- @inquirer/prompts implementation
- `src/application/use-cases/update-use-case.ts` -- add conflict detection and resolution
- `tests/domain/models/conflict-set.test.ts` -- full classification tests
- `tests/infrastructure/adapters/prompter-adapter.test.ts` -- prompter tests
- `tests/application/use-cases/update-use-case.test.ts` -- conflict scenario tests

## Tests
- Classify: unchanged (all hashes equal)
- Classify: user-modified only (disk != manifest, new = manifest)
- Classify: framework-updated only (disk = manifest, new != manifest)
- Classify: both modified (disk != manifest, new != manifest)
- Update with conflicts prompts user
- Update with --force skips prompts
- Manifest reflects kept user version
- Manifest reflects accepted framework version

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
