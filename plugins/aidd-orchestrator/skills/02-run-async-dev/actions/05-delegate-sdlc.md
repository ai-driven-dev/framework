# 05 -- Delegate SDLC

Hands the implementation off to the SDLC capability. The orchestrator picks the branch name and the PR contract; the SDLC owns code, tests, push, and PR creation. The orchestrator only verifies the contract was honoured.

## Inputs

- `issue` (required) -- the locked issue object
- `run_id` (required) -- run identifier from `03-acquire-lock`
- `discovered_skill` (required) -- skill name returned by `04-check-sdlc`
- `config` (required) -- parsed `.claude/aidd-orchestrator.json`
- `trigger_kind` (optional) -- `label` or `comment`; forwarded from dispatch
- `trigger_comment_url` (optional) -- when `trigger_kind=comment`, the URL of the triggering comment

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

**CRITICAL — DO NOT BYPASS.** This action's sole purpose is to set up the feature branch and invoke the SDLC capability. You MUST NOT write feature code, edit feature files, run tests, or open PRs yourself — those tasks belong to the SDLC. The only mutations you are allowed are: (a) the up-front `git checkout -B` of the feature branch from `origin/<default>`, and (b) the contract recovery in step 7. Any other Edit/Write/Bash mutation is a contract violation and must be aborted.

1. Record the default-branch SHA: `git fetch origin && BEFORE=$(git rev-parse origin/<default>)`. Contract baseline.
2. Compute the feature branch name: `feat/issue-<issue.number>-<kebab-slug-of-title>` (truncate slug to 40 chars). Must not equal the default branch.
3. **Create the feature branch up-front.** SDLC is branch-agnostic by design (a manual user may invoke it on any branch); the orchestrator owns branch setup for the async flow. Run `git checkout -B feat/issue-<n>-<slug> origin/<default>`. Assert `git rev-parse --abbrev-ref HEAD` returns the new branch. Spec, plan, implement, and ship will all run on this branch — so their file writes (spec_path, plan_path) land on the feature branch, never on default.
4. **Collect issue comments as additional direction.** Fetch `gh api repos/{owner}/{repo}/issues/<issue.number>/comments --jq '[.[] | select(.user.type != "Bot")]'`. Keep all human comments authored after the previous bot activity on the issue (use `gh api repos/{owner}/{repo}/issues/<issue.number>/timeline` to find the last bot commit/event; fall back to "all comments" on first run). These are the user's directions added since the last attempt and MUST be surfaced to the SDLC. If `trigger_kind=comment`, ensure the comment at `trigger_comment_url` is the first entry in the list.
5. Compose the delegation prompt. Tell the SDLC that HEAD is already on the feature branch and must stay there, embed the human comments verbatim, repeat the non-negotiable constraints at top and bottom:

   ```
   You are implementing GitHub issue #<n>: "<title>".

   HEAD is already on `feat/issue-<n>-<slug>` (checked out from `origin/<default>` by the caller). Stay on it for the entire run; every file you write — spec, plan, code — must land on this branch.

   Constraints:
   - Do NOT check out `<default>`. Do NOT make commits on <default>. Do NOT --force on <default>. Do NOT merge anything.
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

   Human direction posted on the issue since the last bot activity (treat as authoritative additions/corrections to the request; reconcile with the issue body, surface conflicts in the plan rather than silently ignoring):
   <comments collected in step 4, each rendered as `@<author> <created_at>: <body>` separated by `---`>
   ```

6. **MANDATORY — invoke the SDLC skill via the `Skill` tool.** Use the skill name returned in `discovered_skill` (never hardcode). The orchestrator MUST issue exactly one `Skill` tool call with that name and the prompt from step 5 as `args`. Do not call Edit, Write, Bash-with-mutations beyond the branch checkout in step 3 and the contract recovery in step 8, or `gh pr create` yourself; the SDLC owns those. If `discovered_skill` is empty, abort with a `claude/blocked` outcome and a comment listing the issue. The `Skill` tool call is the only way this action can succeed.
7. Capture the SDLC result. If the SDLC did not return a `pr_number`, query the API: `gh pr list --repo <owner>/<repo> --head feat/issue-<n>-<slug> --state open --json number,url --jq '.[0]'`.
8. **Verify the contract** (the SDLC could have ignored instructions):
   - `AFTER=$(git fetch origin && git rev-parse origin/<default>)`.
   - **No commits on default**: if `AFTER != BEFORE`, the SDLC pushed to `<default>`. Recover:
     - Cherry-pick `$BEFORE..$AFTER` onto `feat/issue-<n>-<slug>`, push.
     - `git revert --no-edit $BEFORE..$AFTER` on `<default>`, push.
     - Set `default_branch_advanced = true`. The audit comment names the offending SHAs.
   - **PR exists**: if no PR was returned and none can be found via the API, mark the run failed and route to `06-write-audit` as a contract violation.
   - **PR shape**: assert `headRefName == feat/issue-<n>-<slug>`, `baseRefName == <default>`, body contains `Closes #<n>`. If any field is wrong, post a comment on the PR with the contract violation and let the human fix it; the run still succeeds (PR exists; the lifecycle continues).
9. Forward the structured result to `06-write-audit`. Do not transition labels here; that happens in `06`.

## Test

Clean delegation: `default_branch_advanced == false`, `gh pr view <pr_number>` returns a PR with `headRefName == feat/issue-<n>-<slug>`, `baseRefName == <default>`, body contains `Closes #<n>`. `git log origin/<default>` does NOT contain bot commits for this run id.

Violation: SDLC pushed to default. Action recovers commits onto the feature branch, reverts on default, opens (or recovers) the PR, and emits `default_branch_advanced == true` so `06-write-audit` flags the violation.
