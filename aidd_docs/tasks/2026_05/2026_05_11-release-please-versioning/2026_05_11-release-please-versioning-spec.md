# Release-please versioning unification

## Target

Reconcile the framework's release-please configuration, manifest, commit-scope policy, and CI tarball pipeline so that each plugin in the monorepo versions, tags, and ships independently while the framework root (marketplace.json) remains the single public version of the catalog.

## Hard constraints

- Tag shapes are fixed by the existing release-please flags: root releases stay `v<X.Y.Z>` and plugin releases stay `<plugin>-v<X.Y.Z>`. These flags must not be changed.
- The contract for which commit scope bumps which package is:
  - `framework` and `marketplace` bump the root (marketplace.json) only.
  - `aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-pm`, `aidd-orchestrator`, `aidd-refine` each bump their own plugin only.
  - No other scope is permitted on the main branch.
- The release-please manifest must hold exactly seven entries after this work: root plus the six plugin paths, with each plugin entry equal to the version currently declared in its own `plugin.json` and the root entry equal to the version currently declared in `marketplace.json`.
- The `aidd-pm` plugin must keep its current `release-as: 1.0.0-rc.1` pinning untouched.
- The CI release pipeline must keep producing the existing root-release artefact set when (and only when) the root is released, and must produce a per-plugin source tarball when (and only when) that plugin is released.
- The CI pipeline must not reference any deleted file in the source tarball step.
- The work touches only these five surfaces in the repository: the release-please configuration file, the release-please manifest file, the commitlint configuration file, the CI workflow file, and one contributor-facing documentation surface (CONTRIBUTING.md or the framework README, whichever the implementer judges canonical).
- No source code, no scripts under `scripts/`, no plugin-internal files, and no `aidd_docs/` content other than this task folder may be modified by this work.

## Non-goals

- Do not retro-tag plugin components for the existing root history (no `aidd-<plugin>-v1.0.0` tag is created for the current state).
- Do not modify `scripts/build-dist.sh` or any other build script.
- Do not change the release-please tag-shape flags (`include-component-in-tag`, `include-v-in-tag`), the `release-type`, the `bump-minor-pre-major` flag, or the changelog sections.
- Do not change the `aidd-pm` `release-as` override.
- Do not bump any package version manually as part of this work; the only manifest write that is not a release is the root reconciliation from `3.9.1` to `4.0.0` (see done-when below).
- Do not introduce new commit scopes beyond the seven listed in the contract.
- Do not change the trigger conditions of the existing CI jobs (commitlint job, release-please job).
- Do not migrate any plugin tag, changelog file, or historical release; pre-existing root tags (`v3.x.x`, `v4.1.0-beta.*`) remain as-is.

## Done-when

All conditions below must hold. Each names the artefact that proves it.

1. A commit `feat(aidd-refine): test bump` on main produces a release-please pull request that bumps only `plugins/aidd-refine/.claude-plugin/plugin.json` and, on merge, creates the git tag `aidd-refine-v1.1.0`. Verified by inspecting the release-please PR diff and the resulting tag on the repository.
2. A commit `chore(framework): test bump` (or equivalently `chore(marketplace): ...`) on main produces a release-please pull request that bumps only `marketplace.json` and, on merge, creates the next root semver tag in the `v<X.Y.Z>` shape. Verified by inspecting the release-please PR diff and the resulting tag.
3. When a plugin release is created, the GitHub release for that plugin tag carries the matching `aidd-<plugin>-v<X.Y.Z>.tar.gz` source tarball and no other source tarball. Verified by listing release assets for that tag.
4. When the root is released, the GitHub release for the root tag carries `aidd-framework-v<X.Y.Z>.tar.gz` plus the existing per-tool bundles (`aidd-claude-*`, `aidd-cursor-*`, `aidd-copilot-*`, `aidd-codex-*`, local and remote variants). Verified by listing release assets for that tag.
5. The commitlint configuration accepts commits with scope `aidd-orchestrator`, `aidd-refine`, and `marketplace`, alongside the four pre-existing plugin scopes and `framework`. Verified by running the commitlint config against representative commit messages or by a passing PR using each scope.
6. No reference to `version.txt` remains in the CI workflow file or in any tarball step. Verified by searching the CI workflow file for the string `version.txt` and getting zero matches.
7. The release-please manifest contains exactly seven entries (root plus six plugin paths), each version equal to the version declared in the corresponding `plugin.json` or in `marketplace.json` at the time the work is merged. Verified by diffing the manifest values against the source files.
8. The contributor documentation surface contains a section describing the commit-scope to package mapping defined above (which scope bumps which package). Verified by reading the documentation file.
9. After merge, the next push to main that contains no qualifying release commit produces no release-please pull request and no release. Verified by observing CI on a doc-only or scope-less commit.
10. The root manifest jump from `3.9.1` to `4.0.0` is reconciliation only and produces no tag, no changelog entry, and no GitHub release. Verified by confirming that the merge of this work alone does not create a root release.

## Stakeholders

- Decider: framework maintainer.
- Owner: framework maintainer (CI and release tooling).
- Consumer: every plugin maintainer in the monorepo and every downstream user of the marketplace catalog.

## Context

- Originating ticket: GitHub issue `ai-driven-dev/aidd-framework#81`.
- Drift to be resolved: the manifest root entry trails the public `marketplace.json` version (`3.9.1` vs `4.0.0`); two of the six plugins shipped in the marketplace catalog (`aidd-orchestrator`, `aidd-refine`) are not registered in release-please at all; the commitlint scope list is missing those two plugins and the `marketplace` alias; the CI source tarball step still names a file (`version.txt`) that no longer exists in the repository; the existing CI release job exposes only the top-level release-please outputs, so per-plugin releases cannot be routed to per-plugin asset matrices.
- Risks downstream agents must verify:
  - Re-bootstrap risk: when two new packages enter the release-please configuration, the action may open an initial-release pull request for each. Pre-populating the manifest with their current `plugin.json` versions is intended to suppress that. The first CI run after merge must be observed to confirm no unwanted initial-release PR is opened.
  - Matrix-routing risk: switching the build-and-attach job from a single set of release-please outputs to per-package outputs changes the conditions under which artefacts are uploaded. The job's contract is fully described by done-when 3 and 4; any per-package output names used by the implementer must satisfy both.
  - History risk: commits using `aidd-orchestrator` and `aidd-refine` scopes already exist on main from before commitlint allowed them. The commitlint job only checks new pull requests, so this is not a blocker, but the spec records it.
- Rollback plan: this work lands as a single change touching the five surfaces named in the hard constraints. Rollback is `git revert` of that change. No plugin-component tags exist yet, so no tag cleanup is required on rollback.
