# Part 10 — Collapse infra subdirs

> Move `src/infrastructure/auth/auth-storage.ts` and `src/infrastructure/http/http-client.ts` into `src/infrastructure/adapters/`. Remove now-empty single-file subdirectories.

## Pre-requisites

- No other part required — trivial cleanup, no logic change
- Can land at any time — zero coupling to other parts
- Confirm `auth-reader.ts` in `auth/` subdir first (there may be 2 files: `auth-reader.ts` + `auth-storage.ts`)

## Goal

Per the directory listing:

```
src/infrastructure/auth/    → auth-reader.ts (2.6 KB) + auth-storage.ts (3.1 KB)
src/infrastructure/http/    → http-client.ts (3.2 KB)
src/infrastructure/adapters/ → all other adapters
```

Two subdirectories each contain 1–2 files. `auth/` has 2 files; `http/` has 1. Neither subdir adds navigational value: a developer looking for auth or HTTP implementation will find it in `adapters/` alongside everything else.

Goal: flat `adapters/` directory. No logic change, no rename.

## Architecture compliance

- Files move from `src/infrastructure/{auth,http}/` to `src/infrastructure/adapters/`
- Import paths updated throughout (relative imports only, `.js` extension per TypeScript ESM rules)
- Port interfaces unchanged
- No class renames, no method renames
- `deps.ts` import paths updated

## Steps

### A. Audit before moving

- [ ] Confirm `src/infrastructure/auth/` contents: `auth-reader.ts` + `auth-storage.ts` (or only `auth-storage.ts`?)
  - Current listing shows 2 files: `auth-reader.ts` (2.6 KB) + `auth-storage.ts` (3.1 KB) + `.gitkeep`
- [ ] Confirm `src/infrastructure/http/` contents: `http-client.ts` (3.2 KB) + `.gitkeep`
- [ ] Run `rg "from.*infrastructure/auth" src/` — list all callers of `auth/` files
- [ ] Run `rg "from.*infrastructure/http" src/` — list all callers of `http/` files

### B. Move auth files

- [ ] Move `src/infrastructure/auth/auth-reader.ts` → `src/infrastructure/adapters/auth-reader.ts`
- [ ] Move `src/infrastructure/auth/auth-storage.ts` → `src/infrastructure/adapters/auth-storage.ts`
- [ ] Update all import paths referencing `infrastructure/auth/`
- [ ] Delete `src/infrastructure/auth/` (including `.gitkeep`)

### C. Move http file

- [ ] Move `src/infrastructure/http/http-client.ts` → `src/infrastructure/adapters/http-client.ts`
- [ ] Update all import paths referencing `infrastructure/http/`
- [ ] Delete `src/infrastructure/http/` (including `.gitkeep`)

### D. Verify tests

- [ ] `rg "infrastructure/auth\|infrastructure/http" src/ tests/` — expect empty
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm biome check`

## Tests

No new tests. No logic changes. Existing tests must still pass after import path updates.

### Files to check for import path updates

- `src/infrastructure/deps.ts` (main caller)
- Any test files that import auth or http adapters directly
- `src/infrastructure/adapters/auth-provider-adapter.ts` (may import `auth-storage.ts`)

## Acceptance criteria

- [ ] `src/infrastructure/auth/` directory does not exist
- [ ] `src/infrastructure/http/` directory does not exist
- [ ] `src/infrastructure/adapters/auth-reader.ts` exists
- [ ] `src/infrastructure/adapters/auth-storage.ts` exists
- [ ] `src/infrastructure/adapters/http-client.ts` exists
- [ ] `rg "infrastructure/auth\|infrastructure/http" src/ tests/` returns empty
- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] Bundle size unchanged

## Manual validation

```bash
# Zero refs to old subdirs
rg "infrastructure/auth|infrastructure/http" src/ tests/ && echo "FAIL: old paths remain" || echo "OK"

# New files exist
ls src/infrastructure/adapters/auth-reader.ts src/infrastructure/adapters/auth-storage.ts src/infrastructure/adapters/http-client.ts && echo "OK: files in adapters/"

# Old dirs gone
ls src/infrastructure/auth/ 2>&1 | grep "No such file" && echo "OK: auth/ gone"
ls src/infrastructure/http/ 2>&1 | grep "No such file" && echo "OK: http/ gone"

# Full build + test
pnpm build && pnpm test
```

## Risks / breaking changes

- Zero breaking changes for end users — no public API surface touched
- Only risk: missed import path in a test file; `pnpm typecheck` will catch it
- `auth-reader.ts` and `auth-storage.ts` land in `adapters/` — check for naming collision with any existing adapter file

## Effort

TINY — ~1 hour.

## Commit

```
refactor(infra): collapse auth/ and http/ single-file subdirs into adapters/

Move auth-reader.ts, auth-storage.ts, http-client.ts into adapters/.
Delete now-empty auth/ and http/ subdirectories.
Update all import paths. No logic change, no rename.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-10-collapse-subdirs.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```
