# Plan — Release-please versioning unification

- Issue: [ai-driven-dev/aidd-framework#81](https://github.com/ai-driven-dev/aidd-framework/issues/81)
- Spec: `aidd_docs/tasks/2026_05/2026_05_11-release-please-versioning/2026_05_11-release-please-versioning-spec.md` (immutable)
- Branch: `chore/release-please-versioning`
- Target merge: single PR, squash-merged

## Plan-wide constraints (read before any milestone)

1. **No bumping commits anywhere in this PR.** The only allowed Conventional Commit types are `chore`, `build`, `ci`, `docs`, `refactor`. Never `feat`, `fix`, `perf`, `revert`, `feat!`, `fix!`, or any message containing `BREAKING CHANGE`. The squash-merge PR title is bound by the same rule. Reason: done-when 10 requires the 3.9.1 → 4.0.0 reconciliation to produce no tag and no release. Release-please bumps only on `feat` / `fix` (per `release-please-config.json`'s `changelog-sections` + default semver rules); choosing those types triggers an unwanted root release at merge time.
2. **Five surfaces only.** Source code, `scripts/`, plugin-internal files, and `aidd_docs/` content outside this task folder are out of scope (spec hard constraint). The five permitted files:
   - `release-please-config.json`
   - `.release-please-manifest.json`
   - `commitlint.config.cjs`
   - `.github/workflows/ci.yml`
   - `CONTRIBUTING.md` (chosen documentation surface — already documents commit scopes and Releases, see §Documentation surface decision)
3. **Do not touch:**
   - The four release-please tag-shape flags (`include-component-in-tag`, `include-v-in-tag`, `bump-minor-pre-major`, `release-type`).
   - The `aidd-pm` `release-as: 1.0.0-rc.1` override.
   - The `changelog-sections` array.
   - `scripts/build-dist.sh`.
   - Any pre-existing root tag (`v3.x.x`, `v4.1.0-beta.*`).
   - Plugin-component tag history (no retro-tagging).
4. **Staging discipline.** Working tree has unrelated changes from prior phases. Every milestone commit MUST stage by explicit path. Never `git add -A` or `git add .`. Verify with `git diff --cached --stat` before commit.

## Documentation surface decision

CONTRIBUTING.md (lines 23–61) already documents Releases and the commit-scope table. It is also referenced from README.md and is the convention-of-record. README.md is a marketing entry point. Picking CONTRIBUTING.md keeps the scope documentation in one place, satisfies done-when 8, and lets us delete the stale `version.txt` mention at line 38 in the same milestone (allowed surface).

## Milestones

Ordered for revert/cherry-pick safety even though squash-merge collapses the history. The manifest **must** be updated before the release-please config registers new packages; otherwise release-please opens an initial-release PR for each newcomer on the next push to main.

---

### M1 — Manifest reconciliation (root + register new plugins)

- **Scope:** Bring `.release-please-manifest.json` to exactly the seven entries required by the spec, with each plugin entry equal to the version currently declared in its `plugin.json` and the root entry equal to `marketplace.json`'s `4.0.0`. Order: root, then plugins alphabetically.
- **Files touched:**
  - `.release-please-manifest.json`
- **Expected resulting content:**
  ```json
  {
    ".": "4.0.0",
    "plugins/aidd-context": "1.0.0",
    "plugins/aidd-dev": "1.0.0",
    "plugins/aidd-orchestrator": "1.0.0",
    "plugins/aidd-pm": "1.0.0-rc.1",
    "plugins/aidd-refine": "1.0.0",
    "plugins/aidd-vcs": "1.0.0"
  }
  ```
- **Acceptance criteria (mapped to spec done-when):**
  - Manifest has exactly seven entries — `done-when 7`.
  - Each plugin value equals the value in the corresponding `plugins/<p>/.claude-plugin/plugin.json` — `done-when 7`.
  - Root value equals `marketplace.json#/version` (`4.0.0`) — `done-when 7`.
  - Manifest reconciliation alone does not create a root release (verified at PR merge by observing CI; precondition: commit type is non-bumping) — `done-when 10`.
- **Validation method:**
  ```bash
  jq 'keys | length' .release-please-manifest.json                      # expect 7
  jq -r '."."' .release-please-manifest.json                            # expect 4.0.0
  jq -r '.version' .claude-plugin/marketplace.json                      # expect 4.0.0
  for p in aidd-context aidd-dev aidd-orchestrator aidd-pm aidd-refine aidd-vcs; do
    a=$(jq -r ".\"plugins/$p\"" .release-please-manifest.json)
    b=$(jq -r '.version' "plugins/$p/.claude-plugin/plugin.json")
    [ "$a" = "$b" ] || echo "MISMATCH: $p manifest=$a plugin=$b"
  done
  ```
- **Suggested commit message:**
  `chore(framework): reconcile release-please manifest with marketplace and register aidd-orchestrator, aidd-refine`
- **Dependencies:** none. **Must precede M2.**

---

### M2 — Release-please config: register aidd-orchestrator and aidd-refine

- **Scope:** Add two `packages` entries to `release-please-config.json` mirroring the existing plugin entry shape (`package-name`, `extra-files` writing into `.claude-plugin/plugin.json`'s `$.version`). Order alphabetically with the rest. Do not touch the four tag-shape flags, `release-type`, `bump-minor-pre-major`, `changelog-sections`, or the `aidd-pm` `release-as`.
- **Files touched:**
  - `release-please-config.json`
- **Expected resulting `packages` keys:** `.`, `plugins/aidd-context`, `plugins/aidd-dev`, `plugins/aidd-orchestrator`, `plugins/aidd-pm`, `plugins/aidd-refine`, `plugins/aidd-vcs`.
- **Acceptance criteria:**
  - `packages` contains exactly seven keys matching the manifest keys — `done-when 1, 2, 7`.
  - The two new entries declare `package-name: aidd-orchestrator` / `aidd-refine` and a single `extra-files` entry of type `json` writing to `.claude-plugin/plugin.json` at `$.version` — `done-when 1`.
  - The existing root entry, `aidd-pm` `release-as`, and tag-shape flags are unchanged — spec hard constraints.
- **Validation method:**
  ```bash
  jq '.packages | keys | length' release-please-config.json             # expect 7
  jq '.packages | keys' release-please-config.json                      # expect alphabetical incl. orchestrator, refine
  jq '.packages."plugins/aidd-pm"."release-as"' release-please-config.json  # expect "1.0.0-rc.1"
  jq '."include-component-in-tag", ."include-v-in-tag", ."bump-minor-pre-major", ."release-type"' release-please-config.json
  # diff vs spec values: true, true, false, "generic"
  ```
- **Suggested commit message:**
  `chore(framework): register aidd-orchestrator and aidd-refine in release-please-config`
- **Dependencies:** M1.

---

### M3 — Commitlint scope allow-list update

- **Scope:** Extend the `scope-enum` in `commitlint.config.cjs` to include `aidd-orchestrator`, `aidd-refine`, and `marketplace` alongside the four existing plugin scopes and `framework`. Final allow-list (alphabetical): `aidd-context`, `aidd-dev`, `aidd-orchestrator`, `aidd-pm`, `aidd-refine`, `aidd-vcs`, `framework`, `marketplace`. No other scope is permitted.
- **Files touched:**
  - `commitlint.config.cjs`
- **Acceptance criteria:**
  - Commits with scopes `aidd-orchestrator`, `aidd-refine`, `marketplace` pass commitlint — `done-when 5`.
  - Pre-existing scopes (`aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-pm`, `framework`) still pass — `done-when 5`.
  - An unknown scope (e.g. `bogus`) is rejected — spec hard constraint "no other scope permitted".
- **Validation method (positive + negative):**
  ```bash
  for s in aidd-context aidd-dev aidd-orchestrator aidd-pm aidd-refine aidd-vcs framework marketplace; do
    echo "feat($s): test" | npx commitlint --config commitlint.config.cjs && echo "OK $s" || echo "FAIL $s"
  done
  echo "feat(bogus): test" | npx commitlint --config commitlint.config.cjs   # must exit non-zero
  ```
- **Suggested commit message:**
  `ci(framework): allow aidd-orchestrator, aidd-refine, marketplace scopes in commitlint`
- **Dependencies:** none. Can run in parallel with M1/M2 logically; placed third for narrative cohesion (manifest → config → policy).

---

### M4 — CI pipeline: per-package outputs, plugin tarball, drop `version.txt`

- **Scope:** Rework `.github/workflows/ci.yml` so that the `build-and-attach` job:
  - Reads per-package release-please outputs instead of (or in addition to) the top-level outputs.
  - Runs the existing root-only flow (`bash scripts/build-dist.sh`, framework tarball, 8 per-tool tarballs, `gh release upload` to the root tag) **only when the root was released**.
  - Runs a plugin-only flow (a single source tarball of `plugins/<plugin>/` named `aidd-<plugin>-v<X.Y.Z>.tar.gz`, uploaded to the plugin tag, no per-tool tarballs, no `build-dist.sh`) **only when that plugin was released**.
  - Contains no reference to `version.txt` in any step.
- **Files touched:**
  - `.github/workflows/ci.yml`
- **Implementation notes for the implementer:**
  - `googleapis/release-please-action@v4` exposes per-package outputs keyed by the package path. The canonical access pattern is `${{ steps.release.outputs['.--release_created'] }}`, `${{ steps.release.outputs['plugins/aidd-refine--release_created'] }}`, and the matching `--tag_name` / `--version` siblings. The implementer must confirm this against the action's current documentation and adjust if the key shape differs in the installed version; the contract that must be satisfied is done-when 3 and 4, not a specific output-name convention.
  - The simplest shape: in the `release-please` job, expose `paths_released` and the per-package outputs; in `build-and-attach`, branch with `if:` on each path's `release_created`. Either one matrix job with `strategy.matrix` over the seven packages, or two distinct jobs (root vs plugin), is acceptable as long as both done-when shapes hold.
  - The plugin tarball naming is bound by done-when 3: `aidd-<plugin>-v<X.Y.Z>.tar.gz`. This matches the release-please tag (`aidd-<plugin>-v<X.Y.Z>`), so deriving the tarball name from `tag_name` is the safest pattern.
  - Plugin tarball content: `plugins/<plugin>/` only. No `.claude-plugin/`, no `aidd_docs/`, no per-tool bundles.
  - Do not change the `on:` triggers, the `concurrency` block, or the `commitlint` and `release-please` job conditions (spec non-goal: "do not change the trigger conditions").
  - Keep `actions/checkout@v4`, `actions/setup-node@v4`, the `actions/cache@v4` and `npm install -g @ai-driven-dev/cli@beta` step. These belong to the root flow.
- **Acceptance criteria:**
  - When the root is released: root tag carries `aidd-framework-v<X.Y.Z>.tar.gz` plus the eight per-tool bundles (`aidd-claude-*`, `aidd-cursor-*`, `aidd-copilot-*`, `aidd-codex-*`, in local and remote variants) — `done-when 4`.
  - When a plugin is released: the plugin tag carries exactly one source tarball, `aidd-<plugin>-v<X.Y.Z>.tar.gz`, and no other source tarball — `done-when 3`.
  - `grep -c version.txt .github/workflows/ci.yml` returns `0` — `done-when 6`.
  - The `on:` triggers and the `if:` conditions of the `commitlint` and `release-please` jobs are unchanged — spec non-goal.
- **Validation method:**
  ```bash
  grep -c "version.txt" .github/workflows/ci.yml                        # expect 0
  yq '.on, .jobs.commitlint.if, .jobs."release-please".if' .github/workflows/ci.yml
  # diff vs current file (before this change): top-level on/if values unchanged
  yq '.jobs."build-and-attach".if' .github/workflows/ci.yml             # must reference per-package release_created
  ```
  Functional verification (post-merge, observational, lives in M6) is what proves done-when 3 and 4 actually hold against the action's output shape.
- **Suggested commit message:**
  `ci(framework): per-package release outputs, plugin source tarball, drop version.txt reference`
- **Dependencies:** M1 and M2 (the action cannot expose per-plugin outputs for packages that are not registered).

---

### M5 — Contributor documentation: commit-scope-to-package mapping and stale-reference cleanup

- **Scope:** Update `CONTRIBUTING.md` so that:
  1. The Commit-scope discipline table lists all seven allowed scopes (`aidd-context`, `aidd-dev`, `aidd-orchestrator`, `aidd-pm`, `aidd-refine`, `aidd-vcs`, `framework`) plus the `marketplace` alias, and documents which scope bumps which package (the spec contract: `framework`/`marketplace` → root; each `aidd-*` scope → its own plugin only).
  2. The Releases section is updated to reflect the new model: root releases (tag shape `v<X.Y.Z>`) ship `aidd-framework-v<X.Y.Z>.tar.gz` plus the per-tool bundles; plugin releases (tag shape `<plugin>-v<X.Y.Z>`) ship a single `aidd-<plugin>-v<X.Y.Z>.tar.gz`.
  3. The line 38 mention of `version.txt` in the tarball-contents description is removed (CONTRIBUTING.md is an allowed surface; leaving stale docs immediately after merge defeats the cleanup).
- **Files touched:**
  - `CONTRIBUTING.md`
- **Acceptance criteria:**
  - The Commit-scope discipline section documents the scope → package mapping for all seven scopes plus `marketplace` — `done-when 8`.
  - `grep -c version.txt CONTRIBUTING.md` returns `0` — internal cleanup, supports `done-when 6` spirit even though that done-when is bound to ci.yml.
  - README.md is **not** modified (single surface only; CONTRIBUTING is canonical).
- **Validation method:**
  ```bash
  grep -E "aidd-orchestrator|aidd-refine|marketplace" CONTRIBUTING.md   # all three present
  grep -c version.txt CONTRIBUTING.md                                   # expect 0
  git diff --name-only HEAD~5..HEAD -- README.md                        # expect empty for this run
  ```
- **Suggested commit message:**
  `docs(framework): document commit-scope-to-package mapping and remove stale version.txt reference`
- **Dependencies:** none (logically); placed last so the docs reflect the final state.

---

### M6 — Post-merge verification (observational, no file change)

- **Scope:** After the PR merges, observe the next CI run and the first subsequent push to main. This milestone does not change any file; it gates the SDLC finalize phase.
- **Files touched:** none.
- **Acceptance criteria:**
  - The merge commit's CI run does **not** open a release-please pull request — `done-when 10` (re-bootstrap suppressed).
  - The next push to main that contains no qualifying release commit (e.g. a doc-only push or a `chore(framework): …` push) does not open a release-please PR and does not create a release — `done-when 9`.
  - When a subsequent test commit `feat(aidd-refine): test bump` lands on main, release-please opens a PR that touches only `plugins/aidd-refine/.claude-plugin/plugin.json`, and the merge creates tag `aidd-refine-v1.1.0` — `done-when 1`. (This is the spec's acceptance test; the implementer is not required to perform it in the same PR; it is the canonical post-merge verification.)
  - When a subsequent test commit `chore(framework): test bump` or `chore(marketplace): test bump` lands, release-please opens a PR that touches only `marketplace.json` and the merge creates the next root `v<X.Y.Z>` tag — `done-when 2`. (Same caveat.)
  - The plugin-release test from done-when 1 produces a GitHub release carrying exactly `aidd-refine-v1.1.0.tar.gz` and no other source tarball — `done-when 3`.
  - The root-release test from done-when 2 produces a GitHub release carrying `aidd-framework-v<X.Y.Z>.tar.gz` plus the eight per-tool bundles — `done-when 4`.
- **Validation method (manual, post-merge):**
  - Watch the GitHub Actions tab for the merge commit; confirm no `release-please-action` opens a PR titled "release-please…".
  - For done-when 1 and 2, the maintainer cuts the test commits when ready; the orchestrator does not need to drive these to close this SDLC run.
- **Dependencies:** M1–M5 merged.

## Shared verification commands (Reviewer reference)

```bash
# Manifest shape
jq 'keys | length' .release-please-manifest.json                         # 7
jq '.' .release-please-manifest.json                                     # human-readable diff
node -e "JSON.parse(require('fs').readFileSync('.release-please-manifest.json'))"  # parse check

# Manifest values vs source-of-truth files
jq -r '."."' .release-please-manifest.json                               # 4.0.0
jq -r '.version' .claude-plugin/marketplace.json                         # 4.0.0
for p in aidd-context aidd-dev aidd-orchestrator aidd-pm aidd-refine aidd-vcs; do
  printf '%-20s manifest=%s plugin=%s\n' "$p" \
    "$(jq -r ".\"plugins/$p\"" .release-please-manifest.json)" \
    "$(jq -r '.version' "plugins/$p/.claude-plugin/plugin.json")"
done

# Config shape
jq '.packages | keys' release-please-config.json                         # 7 keys, alphabetical
jq '.packages."plugins/aidd-pm"."release-as"' release-please-config.json # "1.0.0-rc.1"
jq '."include-component-in-tag", ."include-v-in-tag", ."bump-minor-pre-major", ."release-type"' release-please-config.json

# Commitlint scope policy
for s in aidd-context aidd-dev aidd-orchestrator aidd-pm aidd-refine aidd-vcs framework marketplace; do
  echo "chore($s): probe" | npx commitlint --config commitlint.config.cjs && echo "OK $s" || echo "FAIL $s"
done
echo "chore(bogus): probe" | npx commitlint --config commitlint.config.cjs   # must reject

# CI: no version.txt
grep -c "version.txt" .github/workflows/ci.yml                            # 0
grep -c "version.txt" CONTRIBUTING.md                                     # 0

# CI triggers unchanged
yq '.on, .jobs.commitlint.if, .jobs."release-please".if' .github/workflows/ci.yml
```

## Risks the Reviewer must verify (carried forward from spec §Context)

- **Re-bootstrap risk:** Pre-populating the manifest in M1 before registering the new packages in M2 is what suppresses initial-release PRs for `aidd-orchestrator` and `aidd-refine`. M6 confirms it.
- **Matrix-routing risk:** Done-when 3 and 4 bound the build-and-attach contract. The implementer chooses the output-key shape, but it must produce zero source tarballs on plugin releases other than `aidd-<plugin>-v<X.Y.Z>.tar.gz`, and must produce the full root asset set on root releases. The `if:` conditions of `commitlint` and `release-please` jobs are unchanged.
- **History risk:** Pre-existing main commits with `aidd-orchestrator` and `aidd-refine` scopes are not a blocker; commitlint only checks new PRs.
- **Bumping-commit risk (plan-added):** Any commit in this PR that uses `feat`, `fix`, `perf`, `revert`, `!`, or `BREAKING CHANGE` will trigger an unintended root release at squash-merge, violating done-when 10. Every milestone above prescribes a non-bumping commit type. The PR title is bound by the same rule.

## Rollback

Single PR, single revert. No tag cleanup is required because no plugin-component tags exist yet and no root release is produced by this change.

## Suggested PR title

`chore(framework): unify release-please versioning across plugins (#81)`

## Notes for orchestrator

- The planning skill `aidd-dev:01-plan` was deliberately skipped. The spec is unusually well-shaped (10 numbered done-when items, 5 named surfaces, explicit non-goals); a skill invocation would re-render the spec without adding constraint. Direct authoring of this plan against the spec is the more efficient path.
- M6 is observational and does not produce a commit. The orchestrator's finalize phase should track M6 as a post-merge checklist item, not as a code milestone.
