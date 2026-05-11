# Run summary - Release-please versioning unification

- Issue: [ai-driven-dev/aidd-framework#81](https://github.com/ai-driven-dev/aidd-framework/issues/81)
- Branch: `chore/release-please-versioning` (off `feat/plugin-architecture` HEAD)
- Spec: `2026_05_11-release-please-versioning-spec.md` (validated, quality 92)
- Plan: `2026_05_11-release-please-versioning-plan.md` (6 milestones, M6 observational)

## Commits

| SHA | Type | Message |
| --- | --- | --- |
| `c02744b` | docs | spec for release-please versioning unification (#81) |
| `6b8d7b9` | docs | plan for release-please versioning unification (#81) |
| `00a29a1` | chore (M1) | reconcile release-please manifest with marketplace and register aidd-orchestrator, aidd-refine |
| `ced282f` | chore (M2) | register aidd-orchestrator and aidd-refine in release-please-config |
| `ba6f0b5` | ci (M3) | allow aidd-orchestrator, aidd-refine, marketplace scopes in commitlint |
| `908388a` | ci (M4) | per-package release outputs, plugin source tarball, drop version.txt reference |
| `c883ad0` | docs (M5) | document commit-scope-to-package mapping and remove stale version.txt reference |

All commit types are non-bumping (`chore`, `ci`, `docs`) to avoid triggering an unintended root release at squash-merge.

## Files changed (5 spec surfaces + 2 task docs)

```
.github/workflows/ci.yml          +111 lines (per-package matrix, root + plugin jobs, drop version.txt)
.release-please-manifest.json     +8 lines (7 entries: root 4.0.0 + 6 plugins)
CONTRIBUTING.md                   +25 lines (scope table + Releases section, version.txt removed)
commitlint.config.cjs             +5 lines (3 new scopes)
release-please-config.json        +26 lines (2 new packages: aidd-orchestrator, aidd-refine)
aidd_docs/tasks/.../*-spec.md     +61 lines (validated spec)
aidd_docs/tasks/.../*-plan.md     +250 lines (6 milestones with validation snippets)
```

## Done-when status

| # | Criterion | Status | Verified by |
| --- | --- | --- | --- |
| 1 | `feat(aidd-refine):` bumps aidd-refine only and tags `aidd-refine-v<X.Y.Z>` | post-merge | M6 (observational) |
| 2 | `chore(framework):` / `chore(marketplace):` bumps root and tags `v<X.Y.Z>` | post-merge | M6 (observational) |
| 3 | Plugin release attaches only `aidd-<plugin>-v<X.Y.Z>.tar.gz` | post-merge | M6 (observational) |
| 4 | Root release attaches `aidd-framework-v<X.Y.Z>.tar.gz` + 8 per-tool bundles | post-merge | M6 (observational) |
| 5 | Commitlint accepts new scopes | done | M3 implementer ran probe matrix |
| 6 | No `version.txt` reference in ci.yml or tarball steps | done | `grep -c version.txt .github/workflows/ci.yml` = 0 |
| 7 | Manifest has 7 entries aligned with `plugin.json` / `marketplace.json` | done | M1 jq validation |
| 8 | CONTRIBUTING documents scope-to-package mapping | done | M5 |
| 9 | Doc-only push to main produces no release | post-merge | M6 (observational) |
| 10 | 3.9.1 to 4.0.0 manifest reconcile produces no tag/release | post-merge | All commits non-bumping, squash-merge title chore() |

## Risks tracked for post-merge

- **Re-bootstrap**: M1 pre-populated manifest with the two new plugins at their current `plugin.json` versions before M2 registered them in the config. First post-merge CI run must NOT open initial-release PRs for `aidd-orchestrator` or `aidd-refine`.
- **Matrix routing**: The `build-and-attach-plugin` job uses identifier-safe output names (`aidd_<plugin>_release_created` etc.) and a `strategy.matrix` over 6 plugins, guarded by `if: matrix.created == 'true'` at step level. Functional verification requires an actual plugin release.
- **Bumping-commit at merge**: PR title MUST stay `chore(framework): ...`. Any `feat` / `fix` / `!` / `BREAKING CHANGE` in the squash title would trigger an unwanted root release.

## Out of scope (preserved as deltas on the branch)

The branch was cut from `feat/plugin-architecture` HEAD, which carries unrelated uncommitted work that the SDLC did NOT touch:
- `plugins/aidd-context/skills/02-project-init/*` edits
- `plugins/aidd-dev/.claude-plugin/plugin.json`, `plugins/aidd-dev/CATALOG.md`, `README.md`, `SKILL.md` edits
- `plugins/aidd-context/CATALOG.md` edits
- Deletion of `ARCHITECTURE.md`, addition of `CLAUDE.md`
- New untracked files in `.claude/`, `aidd_docs/`, `plugins/aidd-context/skills/02-project-init/assets/CONTRIBUTING.md`, `plugins/aidd-dev/skills/00-sdlc/actions/`, `plugins/aidd-dev/skills/00-sdlc/evals/`

These are tracked separately on `feat/plugin-architecture` and out of scope of this PR.
