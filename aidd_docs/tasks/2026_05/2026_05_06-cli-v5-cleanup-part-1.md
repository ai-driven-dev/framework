# Phase 1 — Memory-stubs orphan delete

> Delete `src/assets/memory-stubs/` (3 orphaned `.md` files). Verify `InstallMemoryStubUseCase` is already gone. No domain logic touched, no callers to update.

## Pre-requisites

- Phase 0 inventory complete and committed (`bae07a9`)

## Goal

`src/assets/memory-stubs/` contains 3 files (`AGENTS.md`, `CLAUDE.md`, `copilot-instructions.md`) that were installed into projects by `InstallMemoryStubUseCase`. That use-case was deleted in commit `8a1e3fb` as part of the memory-ownership shift to plugins. The asset directory is now an orphan with zero references in `src/`. Phase 1 removes it cleanly so the repository carries no dead assets.

This is a purely mechanical phase. No domain models, no use-cases, no ports change.

## Architecture compliance

This phase has no domain or use-case scope — it is a single asset deletion. The only rule to enforce: after deletion, `rg "memory-stubs|InstallMemoryStub" src/` must return zero results, confirming the entire ownership transfer to plugins is complete in both code and assets.

## Steps

- [ ] Verify sanity check: confirm `InstallMemoryStubUseCase` is gone — `rg "InstallMemoryStub" src/` must return empty
- [ ] Verify no remaining code imports from `src/assets/memory-stubs/`: `rg "memory-stubs" src/` must return empty
- [ ] Delete `src/assets/memory-stubs/AGENTS.md`
- [ ] Delete `src/assets/memory-stubs/CLAUDE.md`
- [ ] Delete `src/assets/memory-stubs/copilot-instructions.md`
- [ ] Delete the now-empty `src/assets/memory-stubs/` directory
- [ ] If `src/assets/index.ts` (or equivalent asset loader) references `memory-stubs/`, remove the entry
- [ ] Run `rg "memory-stubs|InstallMemoryStub" src/ tests/` — expect empty output

## Tests

### Unit tests added

None — this phase is a pure deletion with no logic change.

### Tests deleted

None — `InstallMemoryStubUseCase` was already deleted in `8a1e3fb` along with its test file. Verify: `rg "install-memory-stub" tests/` returns empty.

## Acceptance criteria

- [ ] `src/assets/memory-stubs/` directory does not exist
- [ ] `rg "memory-stubs|InstallMemoryStub" src/ tests/` returns empty
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` clean
- [ ] No other asset directory affected

## Manual validation

```bash
# Confirm deletion
ls src/assets/memory-stubs/ 2>&1 | grep "No such file" && echo "OK: directory gone"

# Confirm zero refs
rg "memory-stubs|InstallMemoryStub" src/ tests/ && echo "FAIL: refs found" || echo "OK: zero refs"
```

## Risks / breaking changes

None. These files had zero callers in source. The memory-stub ownership transfer (plugin owns, CLI does not write) was already enforced by the deletion of `InstallMemoryStubUseCase` in commit `8a1e3fb`. This phase removes the stale assets that the use-case would have read.

## Commit

```
chore(assets): delete memory-stubs orphan directory

src/assets/memory-stubs/ (AGENTS.md, CLAUDE.md, copilot-instructions.md)
became orphaned when InstallMemoryStubUseCase was deleted in 8a1e3fb.
Zero references remain in src/. Remove orphan to keep repository clean.

Memory stub ownership: plugin installs its own stubs. CLI does not write
CLAUDE.md / AGENTS.md / copilot-instructions.md (see master plan lock #3).

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-1.md
```
