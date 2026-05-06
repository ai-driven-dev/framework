# Phase 2 — Install legacy purge

> Delete the `--path/--release` install branch, `InstallUseCase` (legacy class), and `ResolveFrameworkUseCase`. The install command survives as a thin marketplace-native wrapper.

## Pre-requisites

- Phase 0 inventory complete

## Goal

`commands/install.ts` has two branches: a marketplace-native path (keep) and a legacy `--path/--release` branch that was the old framework-fetch mechanism. The legacy branch calls `ResolveFrameworkUseCase` which in turn uses `FrameworkResolverAdapter` + `FrameworkCache`. Phase 2 cuts the legacy branch and deletes the associated code.

After Phase 2, `ResolveFrameworkUseCase` has no callers, which unblocks Phase 4's co-deletion of `FrameworkCache` + `FrameworkResolverAdapter` once Phase 3 also removes `SetupUseCase`'s dependency on the `FrameworkResolver` port.

## Architecture compliance

The command thin-wrapper rule is directly in scope here. `commands/install.ts` must emerge from this phase as a clean thin wrapper: flags parsed, one use-case called, result displayed. The legacy branching inside the command (`if (cmdOptions.path !== undefined || cmdOptions.release !== undefined)`) violates the "commands wire, not orchestrate" rule. Removing that branch restores compliance.

Domain layer stays unchanged. No new value objects needed here — this is a pure deletion phase.

## Steps

### A. Delete `InstallUseCase` (legacy class)

- [ ] Delete `src/application/use-cases/install/install-use-case.ts` — this is the legacy class (distinct from `InstallRuntimeConfigUseCase` and `InstallIdeConfigUseCase` which are KEPT)
- [ ] Delete tests: `tests/application/use-cases/install/install-use-case*.test.ts` (legacy class tests only)
- [ ] Verify: `rg "InstallUseCase\b" src/ tests/` returns only references to `InstallRuntimeConfigUseCase` / `InstallIdeConfigUseCase` (not the bare `InstallUseCase`)

### B. Delete `ResolveFrameworkUseCase`

- [ ] Delete `src/application/use-cases/resolve-framework-use-case.ts`
  - Definition: class at line 18
  - Callers: `src/application/commands/install.ts` lines 22 (import), 168 (call) — these are removed in step C below
- [ ] Delete tests: `tests/application/use-cases/resolve-framework-use-case*.test.ts`
- [ ] Verify: `rg "ResolveFrameworkUseCase" src/ tests/` returns empty

### C. Strip legacy branch from `commands/install.ts`

- [ ] Remove `--path` and `--release` option declarations
- [ ] Remove `if (cmdOptions.path !== undefined || cmdOptions.release !== undefined)` branch at lines 164–172
- [ ] Remove import of `ResolveFrameworkUseCase` at line 22
- [ ] Remove import of `ResolveFrameworkUseCase` at line 168 (call site)
- [ ] Keep the marketplace-native install path as the only branch
- [ ] Verify command stays thin: no business logic in the action handler

### D. Strip legacy `setup.ts` flags (setup orchestrator rewrite is Phase 3, but flag removal now)

- [ ] In `src/application/commands/setup.ts`, remove option declarations: `--from`, `--switch-mode`, `--mode <local|remote>`, `--path`, `--release` (lines 62, 71, 72)
- [ ] Drop `mode`, `switchMode`, `from`, `path`, `release` from action handler destructuring (lines 92–95, 125–126)
- [ ] Note: full SetupUseCase orchestrator rewrite is Phase 3 — this step only cuts the flag declarations to unblock typecheck

### E. Delete `InstallPluginsUseCase` (legacy framework plugins — different from marketplace plugin install)

- [ ] Delete `src/application/use-cases/install/install-plugins-use-case.ts`
- [ ] Delete tests: `tests/application/use-cases/install/install-plugins-use-case*.test.ts`
- [ ] Verify: `rg "InstallPluginsUseCase\b" src/ tests/` returns empty

### F. Update `deps.ts` and `cli.ts`

- [ ] Remove any deps wiring for deleted classes: `installUseCase` (legacy), `resolveFrameworkUseCase`, `installPluginsUseCase`
- [ ] Do NOT yet remove `frameworkCache` or `frameworkResolverAdapter` deps — those are co-deleted in Phase 4 with `FrameworkResolverAdapter`
- [ ] Verify `deps.ts` compiles after removals

### G. Verify remaining deps unchanged

- [ ] `InstallRuntimeConfigUseCase` — KEEP, untouched
- [ ] `InstallIdeConfigUseCase` — KEEP, untouched
- [ ] `InstallFrameworkPluginsUseCase` — removal is Phase 5 (still has active callers in `setup-use-case.ts:72` until Phase 3 rewrites it)

## Tests

### Unit tests added

None — this phase is destructive.

### Tests deleted

- `tests/application/use-cases/install/install-use-case*.test.ts`
- `tests/application/use-cases/resolve-framework-use-case*.test.ts`
- `tests/application/use-cases/install/install-plugins-use-case*.test.ts`
- Any adapter tests for `resolve-framework-use-case`

### Remaining tests reviewed

- [ ] Confirm no remaining test instantiates `ResolveFrameworkUseCase` or `InstallUseCase` (bare legacy class)
- [ ] Update any fixture that references `--path`/`--release` install flags

## Acceptance criteria

- [ ] `pnpm test` green (post-deletion suite)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `rg "ResolveFrameworkUseCase|InstallUseCase\b|InstallPluginsUseCase" src/ tests/` returns empty
- [ ] `aidd install --help` does not list `--path` or `--release`
- [ ] `aidd setup --help` does not list `--from / --switch-mode / --mode / --path / --release`
- [ ] `pnpm build` passes
- [ ] Bundle size reduced (record before/after in commit body)

## Manual validation

```bash
# Install help: no legacy flags
aidd install --help | grep -E "\-\-path|\-\-release" && echo "FAIL" || echo "OK"

# Setup help: no legacy flags
aidd setup --help | grep -E "from|switch-mode|mode" && echo "FAIL" || echo "OK"

# Zero refs
rg "ResolveFrameworkUseCase" src/ && echo "FAIL" || echo "OK"
```

## Risks / breaking changes

- **Breaking change** for users still using `aidd install --path <dir>` or `aidd install --release <version>`. These flags are removed with no transition period. Document in CHANGELOG. Marketplace-only flow (`aidd ai install <tool>`) is the replacement.
- Setup command temporarily has stub flags removed without its orchestrator rewrite — Phase 3 completes the setup refactor.

## Commit

```
refactor(install): purge --path/--release legacy branch + ResolveFrameworkUseCase

Remove install legacy path that bypassed marketplace:
- Delete commands/install.ts --path/--release flags and branch (lines 164-172)
- Delete src/application/use-cases/resolve-framework-use-case.ts (callers: install.ts:22,168)
- Delete src/application/use-cases/install/install-use-case.ts (legacy class)
- Delete src/application/use-cases/install/install-plugins-use-case.ts
- Strip setup.ts --from/--switch-mode/--mode/--path/--release flag declarations

FrameworkResolverAdapter and FrameworkCache not yet deleted — co-delete
in Phase 4 once SetupUseCase also drops FrameworkResolver port (Phase 3).

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-2.md
```
