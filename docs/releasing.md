# Releasing

Maintainer playbook for cutting a release of `aidd-framework`. Contributors writing commits should read [`CONTRIBUTING.md`](../CONTRIBUTING.md#releases); this file covers what happens after the release PR opens.

---

- [Overview](#overview)
- [Versioning model](#versioning-model)
- [Normal release flow](#normal-release-flow)
- [Pre-merge checklist](#pre-merge-checklist)
- [What gets published](#what-gets-published)
- [Forcing a version](#forcing-a-version)
- [Pre-releases](#pre-releases)
- [Hotfix](#hotfix)
- [Recovery](#recovery)
- [Manual release (escape hatch)](#manual-release-escape-hatch)

---

## Overview

Releases are automated via [release-please](https://github.com/googleapis/release-please) in `manifest` mode. Every push to `main` evaluates accumulated conventional commits and updates an open **release PR** (`chore: release main`). Merging that PR cuts the tags and creates the GitHub Releases.

This repo ships **7 packages from a single manifest**:

| Path | Package | Tag pattern |
|---|---|---|
| `.` (root) | `aidd-framework` | `vX.Y.Z` |
| `plugins/aidd-context` | `aidd-context` | `aidd-context-vX.Y.Z` |
| `plugins/aidd-dev` | `aidd-dev` | `aidd-dev-vX.Y.Z` |
| `plugins/aidd-vcs` | `aidd-vcs` | `aidd-vcs-vX.Y.Z` |
| `plugins/aidd-pm` | `aidd-pm` | `aidd-pm-vX.Y.Z` |
| `plugins/aidd-orchestrator` | `aidd-orchestrator` | `aidd-orchestrator-vX.Y.Z` |
| `plugins/aidd-refine` | `aidd-refine` | `aidd-refine-vX.Y.Z` |

Versions live in `.release-please-manifest.json`. Config (bump rules, extra-files, release-as) lives in `release-please-config.json`.

---

## Versioning model

Each package bumps independently based on the **scope** of conventional commits since its last tag:

| Commit scope | Affects |
|---|---|
| `aidd-context` | `plugins/aidd-context` only |
| `aidd-dev` | `plugins/aidd-dev` only |
| `aidd-vcs` | `plugins/aidd-vcs` only |
| `aidd-pm` | `plugins/aidd-pm` only |
| `aidd-orchestrator` | `plugins/aidd-orchestrator` only |
| `aidd-refine` | `plugins/aidd-refine` only |
| `framework` / `marketplace` | Root only |

Bump rules (set in `release-please-config.json`):
- `feat` → minor
- `fix`, `perf`, `revert` → patch
- `feat!`, `fix!`, `refactor!`, `BREAKING CHANGE:` → major
- `docs`, `refactor`, `style`, `test`, `build`, `ci`, `chore` → no bump (changelog entry only for `docs`, `refactor`)

`bump-minor-pre-major` is `false`, so `feat` on a `0.x` package will go to `0.y+1` not `1.0`.

---

## Normal release flow

1. **Contributor merges a feature/fix PR to `main`** with a conventional-commit message and the correct scope.
2. **Release-Please workflow runs** (`.github/workflows/ci.yml` → `release-please` job) and either:
   - **Opens or updates the release PR** (`chore: release main` on branch `release-please--branches--main`), accumulating changes since the last release. The release PR body links to `release-please--branches--main--release-notes/release-notes.md` for the full preview.
   - **Or, if the release PR is merged**: tags every bumped package, creates the GitHub Releases, then triggers `build-and-attach` + `build-and-attach plugin` to upload tarballs.
3. **Maintainer reviews + merges the release PR** when ready (see [Pre-merge checklist](#pre-merge-checklist)).
4. **CI builds and uploads tarballs.** No manual `git tag` or `gh release create` needed.

---

## Pre-merge checklist

Before merging the release PR:

- [ ] Manifest diff matches expectations (`.release-please-manifest.json`). No package missing a deserved bump.
- [ ] CHANGELOG entries make sense; obvious typos or wrong-scope commits flagged in a follow-up PR (not blocking).
- [ ] No package set to a pre-release version (`-rc.N`, `-beta.N`) **unless** that is the intent. Check `release-as` lines in `release-please-config.json`.
- [ ] Major bumps have a matching migration entry in [`UPGRADE.md`](../UPGRADE.md).
- [ ] `@ai-driven-dev/cli@beta` is installable: `npm view @ai-driven-dev/cli dist-tags`. The `build-and-attach` job depends on it.
- [ ] `validate.yml` workflow green on the release PR.

---

## What gets published

When the release PR merges and at least one package bumps, the `build-and-attach` job (root release) and `build-and-attach plugin` matrix job (per plugin) attach tarballs to the matching GitHub Release:

**Root release (`vX.Y.Z`):**
- `aidd-framework-X.Y.Z.tar.gz` — framework bundle (`plugins/`, `.claude-plugin/`, `aidd_docs/`)
- `aidd-<tool>-X.Y.Z.tar.gz` and `aidd-<tool>-remote-X.Y.Z.tar.gz` for `tool` in `claude`, `cursor`, `copilot`, `codex`

**Per-plugin release (`<plugin>-vX.Y.Z`):**
- `<plugin>-vX.Y.Z.tar.gz` — single plugin payload

Tarballs are built by `scripts/build-dist.sh`, which depends on the `aidd` CLI (`@ai-driven-dev/cli@beta`). If the CLI is broken, the root tarballs fail; per-plugin tarballs use plain `tar` and are unaffected.

---

## Forcing a version

If you need a specific version (first stable cut, pinning a marketing version, etc.) override the auto-computed bump.

**Option A — `release-as` in config (preferred):**

Edit `release-please-config.json` and set `release-as` on the package:

```json
"plugins/aidd-pm": {
  "package-name": "aidd-pm",
  "release-as": "1.0.0"
}
```

This forces the next release of that package to the given version regardless of accumulated commits. **Remove the line after the release ships**, otherwise the next release will re-publish the same version.

**Option B — manifest edit:**

Manually edit `.release-please-manifest.json` to lower or raise the recorded version. Release-please computes the next bump *from* this value. Use sparingly; it bypasses the conventional-commit log.

---

## Pre-releases

To ship `1.0.0-rc.1`, `2.0.0-beta.2`, etc.:

1. Set `release-as` to the pre-release version (e.g. `"2.0.0-beta.1"`).
2. Merge to `main`. Release-please opens / updates the release PR with that target.
3. Merge the release PR. Tags + GitHub Release marked as pre-release.
4. **Important:** remove `release-as` (or update it) before the next release — release-please will not auto-graduate from `-beta.N` to stable.

Pre-release tags on `0.x` packages are allowed but break SemVer assumptions; prefer stable `0.x.y` bumps for early-stage plugins.

---

## Hotfix

For an urgent fix on the latest release:

1. Branch from `main` (do not branch from a release tag — release-please only watches `main`).
2. Make the minimal change; commit with `fix(<scope>):` (or `fix!:` for breaking) and a clear body.
3. Open a PR. Merge to `main`.
4. Release-please updates the release PR with the new patch bump.
5. Merge the release PR. Tag + tarball publish automatically.

If `main` has unreleased `feat:` commits piling up and you do not want them to ship with the hotfix, you must split: either revert them to a side branch first, or accept that they ride along (a `feat` + `fix` bundle ships as a minor bump).

---

## Recovery

**Release PR shows the wrong version.**
Edit `release-please-config.json` (or `.release-please-manifest.json`) on `main`, push. Release-please regenerates the release PR within one workflow run.

**Release PR has stale or wrong CHANGELOG entries.**
The CHANGELOG is regenerated from commits; the fix is on the source commits. Either land a follow-up `revert:` commit, or edit the CHANGELOG inline in the release PR (release-please will not overwrite manual edits to CHANGELOG sections, but it *will* reorder them on next run; use sparingly).

**`build-and-attach` job failed after tag was cut.**
The tag and release exist with no tarballs. Fix the underlying cause (usually a bad `@ai-driven-dev/cli@beta` pin), then re-run the job from the Actions tab. The job re-uploads with `--clobber`, so re-runs are idempotent.

**Tag was published but the release is wrong (bad commit, missing fix).**
Do **not** delete the tag. Cut a new patch release (`X.Y.Z+1`) with the fix and mark the broken release as "Deprecated" via the GitHub UI.

**Release PR will not regenerate.**
Look for the `autorelease: pending` label on the open release PR. If it is missing, release-please will not act on subsequent commits. Re-add the label and push a no-op commit to `main`.

---

## Manual release (escape hatch)

If release-please is broken or you need to ship an out-of-band version:

```bash
# Tag manually
git tag -a v4.0.1 -m "v4.0.1"
git push origin v4.0.1

# Create the release with notes
gh release create v4.0.1 --title "v4.0.1" --notes-file path/to/notes.md

# Build + attach tarballs locally
bash scripts/build-dist.sh
gh release upload v4.0.1 /tmp/aidd-framework-4.0.1.tar.gz --clobber
```

Then edit `.release-please-manifest.json` on `main` to match the new version so release-please does not try to re-publish it.
