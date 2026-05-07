# Phase 6 — Manifest `repo` + `config` command purge

> Atomically clear all 8 callers of `manifest.repo`, delete `aidd config` command, drop the `repo` field from manifest, drop `--repo` global flag. Per blocker B2, this is the only safe sequencing — partial clearing leaves the codebase inconsistent.

## Pre-requisites

- Phase 3 (setup orchestrator rewrite) landed — `setup-use-case.ts:345` `manifest.repo` read removed in Phase 3
- Phase 4 (cache + adopt + framework-cache co-delete) landed — `framework-resolver-adapter.ts:89,120,131` deleted

## Goal

Phase 0 inventory blocker B2 enumerated 8 active callers of `manifest.repo` plus 2 CLI flag callers:

| Caller | File:Line | Status entering Phase 6 |
|---|---|---|
| `deps.ts` | line 143 | active |
| `setup-use-case.ts` | line 345 | **already removed in Phase 3** |
| `marketplace-register-framework-use-case.ts` | line 50 | active |
| `init-use-case.ts` | lines 123, 134, 136 | active |
| `resolve-framework-use-case.ts` | line 47 | **already deleted in Phase 2** |
| `framework-resolver-adapter.ts` | lines 89, 120, 131 | **already deleted in Phase 4** |
| `cli.ts` | line 62 | active (`--repo` global flag) |
| `global-options.ts` | line 18 | active (parses `--repo`) |
| `commands/config.ts` | lines 28, 63, 105, 127 | active (config cmd reads `manifest.repo`) |

Phase 6 clears the remaining active callers (4 src files + 2 CLI flag sites + the config command) atomically.

## Architecture compliance

`manifest.repo` was a runtime override for the framework GitHub repo. In the marketplace-only architecture, marketplace registration replaces it (each marketplace declares its own source). The field is dead — removing it shrinks the `Manifest` aggregate's surface and matches the marketplace-only invariant.

`aidd config` command reads `manifest.repo`/`manifest.docsDir` and writes `manifest.repo`. With `repo` gone and `docsDir` hardcoded (Phase 7), there is no remaining writable manifest field — the command becomes empty. Delete entirely.

## Steps

### A. Clear remaining `manifest.repo` reads

- [ ] In `src/infrastructure/deps.ts:143`: remove `manifest.repo` read; replace any default-repo fallback with marketplace registration check
- [ ] In `src/application/use-cases/marketplace/marketplace-register-framework-use-case.ts:50`: remove `manifest.repo` read; use the input `frameworkPath` or default URL directly
- [ ] In `src/application/use-cases/init-use-case.ts:123,134,136`: remove all `manifest.repo` reads. Init no longer needs a custom repo — marketplace registration replaces this concept entirely. If `init-use-case.ts` is now dead post-Phase 3 setup rewrite, delete it instead.

### B. Delete `--repo` global CLI flag

- [ ] In `src/cli.ts:62`: remove `.option("--repo <owner/repo>", ...)` declaration
- [ ] Remove `repo?: string` from `program.opts<...>()` typing in `cli.ts`
- [ ] In `src/application/commands/global-options.ts:18`: remove `repo` from parsed options
- [ ] In every command that accepts `repo` from `parseGlobalOptions`: remove the parameter pass-through

### C. Delete `aidd config` command

- [ ] Delete `src/application/commands/config.ts` (4 reads of `manifest.repo` at lines 28, 63, 105, 127; 2 reads of `manifest.docsDir` at lines 27, 62; `withRepo` write at line 145)
- [ ] Remove `registerConfigCommand` import + call from `src/cli.ts` (lines 6, 42)
- [ ] Delete tests: `tests/application/commands/config*.test.ts`

### D. Drop `repo` field from manifest

- [ ] In `src/domain/models/manifest.ts`:
  - [ ] Remove `repo?: string` from `ManifestData` interface
  - [ ] Remove `repo?: string` from constructor params
  - [ ] Remove `readonly repo?: string` field
  - [ ] Remove `withRepo()` method
  - [ ] Remove `DEFAULT_REPO` static constant
  - [ ] Remove `validateRepoFormat` export and `REPO_FORMAT_REGEX`
  - [ ] In `serialize()`: remove `repo` field emission
  - [ ] In `deserialize()`: ignore legacy `repo` field (silent strip during migration)
- [ ] In `src/domain/errors.ts`: delete `InvalidRepoFormatError` class

### E. Update `deps.ts` and adapter signatures

- [ ] Remove `repo?: string` from `createDeps(projectRoot, options, output)` signature
- [ ] Remove repo plumbing through `marketplaceFetcher`, `pluginFetcher`, `currentVersionProvider` constructors
- [ ] Verify auth-related `repo` usages (auth uses GitHub host detection, not `manifest.repo`) are preserved

### F. Update tests

- [ ] Update fixtures with `repo` field — strip it (deserialize will silently ignore from now on)
- [ ] Update unit tests that asserted on `manifest.repo` value or `withRepo()` calls
- [ ] Update menu tests if they reference config command

## Tests

### Unit tests

- [ ] `tests/domain/models/manifest.unit.test.ts` — verify `repo` field gone from serialized output, deserialize silently ignores legacy `repo`
- [ ] `tests/domain/errors.unit.test.ts` — `InvalidRepoFormatError` no longer importable

### Integration tests

- [ ] Adapter integration tests using `--repo` flag updated to drop the flag

### Tests deleted

- `tests/application/commands/config*.test.ts`

## Acceptance criteria

- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `rg "manifest\.repo\b|withRepo\b|DEFAULT_REPO\b|InvalidRepoFormatError" src/ tests/` returns empty (only legacy-deserialize comment remnants OK)
- [ ] `aidd config` command no longer exists (`aidd config list` → "unknown command")
- [ ] `aidd --help` does not list `--repo` global flag
- [ ] `aidd setup --repo foo/bar` errors with "unknown option"
- [ ] `pnpm build` passes
- [ ] Bundle size measurably smaller (record in commit)

## Manual validation

```bash
cd /tmp && rm -rf phase6-test && mkdir phase6-test && cd phase6-test
aidd setup --source remote --ai claude --no-plugins --yes

# Manifest does not contain repo
cat .aidd/manifest.json | jq 'has("repo")'
# expect: false

# Config command gone
aidd config list 2>&1 | grep -i "unknown" && echo "OK" || echo "FAIL"

# --repo flag gone
aidd --help | grep -E "\-\-repo" && echo "FAIL" || echo "OK"
```

## Risks / breaking changes

- Users invoking `aidd <cmd> --repo <owner>/<repo>` break. Document in CHANGELOG migration guide: marketplace registration replaces.
- Users with `repo` field in manifest: silently stripped on next deserialize/save round-trip. No data loss — they didn't need it.
- `aidd config` users: removed. Document in CHANGELOG.
- `init-use-case.ts` may end up either reworked or fully deleted depending on Phase 3 SetupUseCase scope absorbing init responsibilities.

## Commit

```
refactor(manifest): drop repo field + aidd config command + --repo flag

Atomically clear 8 active manifest.repo callers + 2 CLI flag sites:
- deps.ts:143
- marketplace-register-framework-use-case.ts:50
- init-use-case.ts:123-136
- cli.ts:62 (--repo global flag)
- global-options.ts:18 (--repo parsing)
- config.ts:28,63,105,127 (4 reads + withRepo write)

Delete aidd config command (no remaining writable manifest field after
docsDir hardcoded in Phase 7 and repo dropped here).

Drop manifest.repo / withRepo / DEFAULT_REPO / validateRepoFormat /
InvalidRepoFormatError. Marketplace registration source replaces the
runtime repo override concept.

Legacy manifests with repo field: silently stripped on round-trip.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-6.md
```
