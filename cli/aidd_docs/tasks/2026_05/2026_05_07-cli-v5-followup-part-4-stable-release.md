# Part 4 — Stable v5 release

> Ship `4.1.0-beta.11` → `4.1.0` stable on npm and GitHub Packages. Finalize CHANGELOG, bump version, trigger release-please flow, cut GitHub release with assets.

## Pre-requisites

- `pnpm test` 100% green on branch `feat/plugin-architecture` merged to `main`
- Part 7 (bundle budget) recommended — confirms no bundle regression before shipping stable
- Part 6 (mutation testing) optional — can ship without it, but confidence is higher with it
- No outstanding breaking changes undocumented in CHANGELOG

## Goal

The last published version is `4.1.0-beta.11`. This part ships the stable `4.1.0` release with:

1. Final CHANGELOG sweep — all breaking changes listed, migration table verified
2. `package.json` version bumped to `4.1.0` (or let release-please handle it)
3. npm publish via release-please tag flow (existing `ci.yml` handles OIDC publish)
4. GitHub release with human-readable release notes
5. Per-tool tarballs from `scripts/build-dist.sh` attached as release assets (if applicable)
6. README npm install snippet updated to `@ai-driven-dev/cli@latest`

## Architecture compliance

No code changes. Release artifacts only.

## Steps

### A. CHANGELOG sweep

- [ ] Open `CHANGELOG.md` — verify all breaking changes from `feat/plugin-architecture` are listed
  - Removed: `--path / --release` install flags
  - Removed: `--from / --switch-mode / --mode` setup flags
  - Removed: `adopt` command (if applicable)
  - Manifest schema v5 change (`{ version, tools, marketplaces }`)
  - Memory stub ownership transferred to plugins
- [ ] Add migration table: old command → new command equivalent
- [ ] Verify `4.1.0-beta.X` entries are collapsed into a single `4.1.0` entry (or kept as-is per release-please format)

### B. Version bump

- [ ] Update `package.json` `"version"` from `"4.1.0-beta.11"` to `"4.1.0"`
- [ ] Update `.release-please-manifest.json` if it tracks the version
- [ ] Commit: `chore(release): bump version to 4.1.0`

### C. Confirm CI green on `main`

- [ ] Merge `feat/plugin-architecture` → `main` (or create release branch)
- [ ] Wait for `ci.yml` jobs: typecheck + lint + test + knip + jscpd all green
- [ ] Confirm `release-please` job produces a release PR

### D. Trigger publish

- [ ] Merge release-please PR (or use `workflow_dispatch` with tag `v4.1.0`)
- [ ] Verify npm publish job succeeds: check https://www.npmjs.com/package/@ai-driven-dev/cli
- [ ] Verify GitHub Packages publish succeeds

### E. GitHub release

- [ ] Edit auto-generated GitHub release notes for readability
- [ ] Add migration guide link or inline the migration table
- [ ] Attach per-tool tarballs if `build-dist.sh` produces them

### F. Post-release validation

- [ ] `npm install -g @ai-driven-dev/cli@latest` in a clean environment
- [ ] `aidd --version` → `4.1.0`
- [ ] `aidd setup --source remote --yes` succeeds against live framework repo

## Tests

No new tests for this part — release procedure only.

### Smoke after publish

```bash
npm install -g @ai-driven-dev/cli@latest
aidd --version               # expect: 4.1.0
aidd setup --source remote --yes
aidd plugin list
```

## Acceptance criteria

- [ ] `npm view @ai-driven-dev/cli version` returns `4.1.0`
- [ ] GitHub release `v4.1.0` visible with notes
- [ ] `aidd --version` returns `4.1.0` from freshly installed global
- [ ] CHANGELOG contains migration table for all breaking changes
- [ ] No `beta` in `aidd --version` output
- [ ] `aidd setup --source remote --yes` succeeds in clean tmp project

## Manual validation

```bash
# In a clean shell (no local dev build on PATH)
npm install -g @ai-driven-dev/cli@4.1.0
aidd --version
# expect: @ai-driven-dev/cli/4.1.0

rm -rf /tmp/v5-release-test && mkdir /tmp/v5-release-test && cd /tmp/v5-release-test
aidd setup --source remote --all --no-plugins --yes
ls .aidd/manifest.json && echo "OK: manifest created"
```

## Risks / breaking changes

- release-please manipulates `package.json` and CHANGELOG automatically — do not manually edit those files if release-please is managing them; coordinate the bump in the release-please PR
- npm publish uses OIDC trusted publishing (`id-token: write`) — verify npm package provenance settings are correct before shipping
- If beta users have pinned `4.1.0-beta.X` in scripts, they need to update; note in release notes

## Effort

SMALL — ~1 day (mostly coordination + verification).

## Commit

```
chore(release): bump version to 4.1.0

Ship stable v5 release. CHANGELOG finalized with breaking-change
migration table. All beta pre-release entries collapsed.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-4-stable-release.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```
