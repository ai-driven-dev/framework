# 05 -- Delegate SDLC

Hands the implementation off to the SDLC capability. The orchestrator picks the branch name and the PR contract; the SDLC owns code, tests, push, and PR creation. The orchestrator only verifies the contract was honoured.

## Inputs

- `issue` (required) -- the locked issue object
- `run_id` (required) -- run identifier from `03-acquire-lock`
- `discovered_skill` (required) -- skill name returned by `04-check-sdlc`
- `config` (required) -- parsed `.claude/aidd-orchestrator.json`

## Outputs

```json
{
  "branch": "feat/issue-<n>-<slug>",
  "pr_number": 117,
  "pr_url": "https://github.com/org/repo/pull/117",
  "tests_passed": true,
  "duration_seconds": 612,
  "default_branch_head_before": "<sha>",
  "default_branch_head_after": "<sha>",
  "default_branch_advanced": false
}
```

## Depends on

- `04-check-sdlc`

## Process

**CRITICAL — DO NOT BYPASS.** This action's sole purpose is to invoke the SDLC capability. You MUST NOT write code, edit files, run tests, push branches, or open PRs yourself. Those tasks belong to the SDLC skill. Your only job is: build the delegation prompt, call the Skill tool, then verify the contract. Any direct Edit/Write/Bash usage to implement the feature is a contract violation and must be aborted.

1. Record the default-branch SHA: `git fetch origin && BEFORE=$(git rev-parse origin/<default>)`. Contract baseline.
2. Compute the feature branch name: `feat/issue-<issue.number>-<kebab-slug-of-title>` (truncate slug to 40 chars). Must not equal the default branch.
3. Compose the delegation prompt with these explicit, non-negotiable constraints (state at the top AND repeat at the bottom):

   ```
   You are implementing GitHub issue #<n>: "<title>".

   Constraints:
   - Work on a new branch named exactly: feat/issue-<n>-<slug>.
     Create it from origin/<default>: git checkout -B feat/issue-<n>-<slug> origin/<default>.
   - Do NOT make commits on <default>. Do NOT --force on <default>. Do NOT merge anything.
   - Run the project's test command before opening the PR; tests must pass.
   - Push the branch: git push -u origin feat/issue-<n>-<slug>.
   - Open a Pull Request:
       title: "feat: <title> (#<n>)"
       base:  <default>
       head:  feat/issue-<n>-<slug>
       body:  must contain "Closes #<n>" so GitHub auto-links the issue.
     Use `gh pr create --base <default> --head feat/issue-<n>-<slug> --title "..." --body "..."`.
   - Return a structured result with: { branch, pr_number, pr_url, tests_passed, commit_shas[] }.

   Issue body and labels follow.
   <issue body>
   <issue labels>
   ```

4. **MANDATORY — invoke the SDLC skill via the `Skill` tool.** Use the skill name returned in `discovered_skill` (never hardcode). The orchestrator MUST issue exactly one `Skill` tool call with that name and the prompt from step 3 as `args`. Do not call Edit, Write, Bash-with-mutations, or `gh pr create` yourself; the SDLC owns those. If `discovered_skill` is empty, abort with a `claude/blocked` outcome and a comment listing the issue. The `Skill` tool call is the only way this action can succeed.
5. Capture the SDLC result. If the SDLC did not return a `pr_number`, query the API: `gh pr list --repo <owner>/<repo> --head feat/issue-<n>-<slug> --state open --json number,url --jq '.[0]'`.
6. **Verify the contract** (the SDLC could have ignored instructions):
   - `AFTER=$(git fetch origin && git rev-parse origin/<default>)`.
   - **No commits on default**: if `AFTER != BEFORE`, the SDLC pushed to `<default>`. Recover:
     - Cherry-pick `$BEFORE..$AFTER` onto `feat/issue-<n>-<slug>`, push.
     - `git revert --no-edit $BEFORE..$AFTER` on `<default>`, push.
     - Set `default_branch_advanced = true`. The audit comment names the offending SHAs.
   - **PR exists**: if no PR was returned and none can be found via the API, mark the run failed and route to `06-write-audit` as a contract violation.
   - **PR shape**: assert `headRefName == feat/issue-<n>-<slug>`, `baseRefName == <default>`, body contains `Closes #<n>`. If any field is wrong, post a comment on the PR with the contract violation and let the human fix it; the run still succeeds (PR exists; the lifecycle continues).
7. Forward the structured result to `06-write-audit`. Do not transition labels here; that happens in `06`.

## Test

Clean delegation: `default_branch_advanced == false`, `gh pr view <pr_number>` returns a PR with `headRefName == feat/issue-<n>-<slug>`, `baseRefName == <default>`, body contains `Closes #<n>`. `git log origin/<default>` does NOT contain bot commits for this run id.

Violation: SDLC pushed to default. Action recovers commits onto the feature branch, reverts on default, opens (or recovers) the PR, and emits `default_branch_advanced == true` so `06-write-audit` flags the violation.
