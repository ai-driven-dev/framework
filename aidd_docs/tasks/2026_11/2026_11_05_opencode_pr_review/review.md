# Review: Simplify OpenCode PR review

## Round 1

- Diff: `next...c7c94d3`
- Uncommitted changes: no, excluding this report.
- Axes: code, functional, relevancy.
- Verdict: changes-requested, because the requested runtime, PR context, and safe activation are not yet in place.

### Criteria

- [x] Select the submitted commit and skip unchanged diffs — `scripts/pr-review/review.sh:37` and `:300`.
- [ ] Install the project's CLI version and plugins, or use `latest` when its manifest is absent — `docker/aidd-opencode/Dockerfile:3` pins a framework commit.
- [ ] Let the reviewer inspect Git and PR discussion and use installed skills — `scripts/pr-review/model.sh:10` and `:31` deny GitHub credentials and shell access.
- [ ] Extract the workflow scripts and remove the two disposable tests — `.github/workflows/opencode-review.yml:44`, `.github/workflows/opencode.yml:103`, and `scripts/pr-review/test-model.sh` remain unchanged.
- [ ] Run the CI on the user's servers — `aidd_docs/tasks/2026_11/2026_11_05_opencode_pr_review/phase-2.md:45` still chooses `ubuntu-slim`; the existing self-hosted groups do not allow this public repository.
- [ ] Verify and document the refactored flow — the implementation has not yet changed.
- Unverified at runtime: the final server runner, default-branch activation, and the requested `npx` plus GitHub review flow.

### Assumptions

- The runtime used by `/opencode` exists on `main` — false on 2026-11-06: `gh api repos/ai-driven-dev/framework/git/trees/main?recursive=1` returned no `docker/aidd-opencode/` paths. A `pull_request_review_comment` run was dispatched for this branch but skipped its job: https://github.com/ai-driven-dev/framework/actions/runs/42133530922. GitHub runs these workflows from the PR merge commit: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target, read 2026-11-06.
- The `aidd-opencode-review` runner group exists and can serve `framework` — false on 2026-11-06 according to `gh api orgs/ai-driven-dev/actions/runner-groups`; no such group is listed and the existing groups disallow public repositories. GitHub runner-group restrictions: https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/manage-access, read 2026-11-06.
- OpenCode `2.2.5` is current — holds on 2026-11-06: `npm view @opencode/cli@latest version` returned `2.2.5`; registry: https://registry.npmjs.org/%40opencode%2Fcli/latest.

### Findings

- `scripts/pr-review/review.sh:56`: the automatic reviewer receives the PR title and description, but not the submitted review body or its inline comments. `scripts/pr-review/model.sh:10` and `:31` also prevent it from retrieving them or running `git diff`. A general `/opencode` request likewise omits inline comments at `.github/workflows/opencode.yml:110`. Give the reviewer Git and PR read access, and publish the answer separately with the write token — 🟡 major, P1.
- `docker/aidd-opencode/Dockerfile:3`: every project receives one bundled framework commit, and `.github/workflows/opencode.yml:210` disables project configuration. The requested project version, plugin list, and `latest` fallback are not used. Install the project runtime through `npx` in a separate temporary directory — 🟡 major, P1.
- `scripts/pr-review/model.sh:77`: a successful review is rejected unless a specifically named agent loads `05-review` and reads each action. This prevents a generic reviewer and freely callable installed skills. Remove the identity and skill-specific trace checks while retaining honest incomplete-review handling — 🟡 major, P1.
- `.github/workflows/opencode.yml:75`: an inline `/opencode` event using this PR's workflow checks out `main`, then builds `.aidd-runtime/docker/aidd-opencode` at `:167`; that path is absent from `main`. If the job is triggered before the runtime is promoted to `main`, it cannot build the image. Remove that image dependency or make the trusted runtime available before enabling the workflow — 🟡 major, P1.

### Simplification

- Keep a trusted review trigger, the exact submitted commit, one per-file fingerprint checkpoint, and separate GitHub write credentials.
- Use `npx` for the project version or `latest`, expose Git and PR discussion in read-only mode, and publish the result with `gh`.
- Remove the hard-coded agent/skill trace checks and the two disposable model/conversation test scripts after local proof. Consider removing persistent publication drafts if an occasional repeated model call after publication failure is acceptable.
- Configure a dedicated isolated server runner for the public repository; do not put untrusted PR jobs on the existing shared runners.

### Limits

- This review was read-only and ran no tests. In the preceding turn, the existing scripts and image builds passed under OrbStack, with GitHub and the model simulated in the script tests; the proposed refactor itself was not implemented or tested.
- The reviewed submission has 14 unresolved threads. The only commit after it, `c7c94d3`, adds the plan files; it changes no runtime code.
