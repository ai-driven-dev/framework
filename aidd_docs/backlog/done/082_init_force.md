---
id: 082
milestone: M8
title: "Add --force flag to aidd init for docs re-initialization"
stories: []
points: 2
blockedBy: []
---

# 082: Add --force flag to aidd init for docs re-initialization

## Context

When framework templates evolve (new template files added or existing ones changed), users have no way to refresh their `aidd_docs/` directory without running `aidd clean --force` first — which destroys all tool distributions and the manifest.

`aidd update` (ticket 060) explicitly does NOT update docs templates (only tool distributions). This means docs templates are stranded at their initial version indefinitely. `aidd init --force` fills this gap by re-copying only the docs templates without touching the manifest or tool files.

## Scope

Add `--force` flag to `aidd init` that overwrites the existing docs directory. Does not reset the manifest or any tool distributions.

## Acceptance Criteria

- [ ] `aidd init --force` re-copies all docs templates from the latest framework version into the existing docs directory
- [ ] Files that exist and are identical (hash match) are skipped (no-write optimization)
- [ ] Files that exist and differ: overwritten with warning `Overwriting modified file: {filePath}`
- [ ] New template files added to the framework since initial init: created
- [ ] Manifest docs section is updated with new hashes
- [ ] Tool distributions are NOT touched (no files written/deleted outside the docs dir)
- [ ] `--force` without prior `init` (no manifest): fails with `No AIDD installation found. Run aidd init first.`
- [ ] `aidd init` without `--force` when docs dir exists: existing behavior unchanged (`error.init.dir_exists`)

## Technical Notes

- **UX Copy source of truth**: use keys `warn.init.force_overwrite` and existing `success.init` (section to be added to `ux_copy.md`).
- `InitUseCase` receives `force: boolean` in options. When `force` is true and docs dir exists: proceed with template copy instead of failing.
- Hash comparison before overwrite: use `Hasher.hash(existingContent)` vs `Hasher.hash(newContent)`. If equal, skip the write.
- Manifest update: update only the `docs` section entries with new hashes. Do not touch any `tools` entries.
- The framework is resolved fresh (download/cache) to get the latest templates — same resolution chain as normal init.
- `ensureInitialized()` guard: NOT used here. `init --force` checks for manifest existence manually and fails with guidance if missing (different message than the guard's generic error).

## Files to Create/Modify

- `src/application/use-cases/init-use-case.ts` — add `force: boolean` option, skip-on-hash-match, manifest docs update
- `src/application/commands/init.ts` — add `--force` flag, pass to use case
- `tests/application/use-cases/init-use-case.test.ts` — add force scenarios
- `tests/e2e/init.e2e.test.ts` — add force E2E scenarios

## Tests

- `init --force` on existing dir: templates re-copied, manifest docs updated
- `init --force` identical files: skipped (no write)
- `init --force` modified file: overwritten with warning
- `init --force` new framework template file: created
- `init --force` tool distributions: untouched
- `init --force` without manifest: fails with guidance
- `init` without `--force` on existing dir: `error.init.dir_exists` (unchanged behavior)

## Done When

- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
