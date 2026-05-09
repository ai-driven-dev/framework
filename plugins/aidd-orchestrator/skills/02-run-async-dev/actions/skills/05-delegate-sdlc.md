# 05 -- Delegate SDLC

Hands the implementation off to the SDLC capability discovered at runtime, on a dedicated feature branch. The orchestrator owns the branch, the push, and the PR creation -- the SDLC capability only writes the code and the tests.

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

1. Record the current default-branch SHA: `git fetch origin && BEFORE=$(git rev-parse origin/<default>)`. Contract baseline; must not change.
2. Compute a feature branch name: `feat/issue-<issue.number>-<kebab-slug-of-title>` (truncate slug to 40 chars). The branch must not equal the default branch.
3. Create and check out the branch from `origin/<default>`: `git checkout -B "$BRANCH" "origin/<default>"`.
4. Compose the delegation prompt with these strict constraints, **stated up front and repeated at the bottom**:
   - "You must work only on the current branch `<BRANCH>`."
   - "**Do NOT** `git push`, **do NOT** `gh pr create`. The orchestrator will push and open the PR after you return."
   - "**Do NOT** make any commit on `<default>`. Never `--force` on the default branch."
   - "Write the source files and test files, then run the project's test command. Tests must pass before you return."
   - "Return a structured result naming the local commit SHA(s), the test outcome, and the file list."
   - Include the issue title, body, labels.
5. Invoke the skill named in `discovered_skill` via the `Skill` tool with that prompt. Read the skill name from input; never hardcode.
6. Capture the SDLC result: local commit SHAs, test outcome, file list. If tests failed, abort with a structured error and route to `06-write-audit` as a failure.
7. **Enforce the no-push-to-main contract**:
   - `AFTER=$(git rev-parse origin/<default>)` after `git fetch origin`.
   - If `AFTER != BEFORE`: hard violation. Recover by cherry-picking `$BEFORE..$AFTER` onto `<BRANCH>`, then `git revert --no-edit $BEFORE..$AFTER` on `<default>` and push. Set `default_branch_advanced = true`. If recovery is impossible, mark the run failed and route to `06-write-audit`.
   - Else `default_branch_advanced = false`.
8. **Push the feature branch and open the PR** (the orchestrator owns this step; never delegate it):
   - `git push -u origin "$BRANCH"`.
   - Generate the PR body: `## Summary\n\n<concise bullet list from SDLC's file list>\n\nCloses #<issue.number>`. Title: `feat: <issue.title> (#<issue.number>)`.
   - `gh pr create --base <default> --head "$BRANCH" --title "<title>" --body "<body>"`.
   - Capture the returned PR number and URL.
9. Forward the structured result to `06-write-audit`. Do not transition labels here; that happens in `06`.

## Test

After a clean delegation: `default_branch_advanced == false`, `gh pr view <pr_number> --json number,headRefName,baseRefName` returns the PR with `headRefName == <BRANCH>` and `baseRefName == <default branch>`. The PR body contains `Closes #<issue.number>`. `git log origin/<default>` does NOT contain bot commits for this run id. The branch and the PR exist on the remote even though the SDLC capability did neither.

After a delegation where the SDLC violated and committed on default: action recovers commits onto the feature branch, reverts on default, opens the PR, and emits `default_branch_advanced == true` so `06-write-audit` flags the violation in the audit record.
