# 05 -- Delegate SDLC

Hands the implementation off to the SDLC capability discovered at runtime, on a dedicated feature branch, with a strict no-push-to-main contract that this action enforces in code -- not just in the prompt.

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

1. Record the current default-branch SHA: `BEFORE=$(git rev-parse origin/<default>)`. This is the contract baseline; it must not change during delegation.
2. Compute a feature branch name: `feat/issue-<issue.number>-<kebab-slug-of-title>` (truncate slug to 40 chars). The branch must not equal the repo default branch.
3. Create and checkout the branch from `origin/<default>`: `git fetch origin && git checkout -B "$BRANCH" "origin/<default>"`.
4. Compose the delegation prompt with these strict constraints, **stated up front and repeated at the bottom**:
   - "You must work only on the current branch `<BRANCH>`. Never `git push` to `<default>` or any default branch. Never use `--force` on the default branch."
   - "Open a Pull Request from `<BRANCH>` against `<default>`. Never merge it; the human merges."
   - "Reference the issue with `Closes #<n>` in the PR body so GitHub auto-links it."
   - "The test command must pass before opening the PR."
   - Include the issue title, body, labels.
5. Invoke the skill named in `discovered_skill` via the `Skill` tool with that prompt. Read the skill name from input; never hardcode.
6. Capture the SDLC result. **Then enforce the contract**:
   - `AFTER=$(git rev-parse origin/<default>)` after a `git fetch origin`.
   - If `AFTER != BEFORE`: the default branch advanced during delegation. Treat as a hard contract violation:
     - Fetch the new commits: `git log $BEFORE..$AFTER --oneline`.
     - If those commits look like the SDLC's implementation (matching authored email or commit-message pattern), recover them onto the feature branch by cherry-picking: `git checkout "$BRANCH" && git cherry-pick $BEFORE..$AFTER`. Then revert them on the default branch: `git checkout <default> && git revert --no-edit $BEFORE..$AFTER && git push`. Push the recovered branch.
     - If recovery is not possible (commits unrelated, conflicts, etc.), do NOT touch the default branch silently. Mark the run failed and route to `06-write-audit` as `default_branch_advanced = true`. The audit comment on the issue must list the offending SHAs.
   - Set `default_branch_advanced` in the output accordingly.
7. Verify a PR exists for the feature branch (`gh pr view <BRANCH>`). If none, also a contract violation: route to `06-write-audit` as failure.
8. Forward the structured result to `06-write-audit`. Do not transition labels here; that happens in `06`.

## Test

After a clean delegation run: `default_branch_advanced == false`, `gh pr view <pr_number> --json number,headRefName,baseRefName` returns the PR with `headRefName == <BRANCH>` (not the default branch), `baseRefName == <default branch>`, the PR body contains `Closes #<issue.number>`, and `git log origin/<default>` does NOT contain bot commits for this run id.

After a delegation run where the SDLC violated and pushed to default: action recovers the commits onto the feature branch, reverts them on default with a single `Revert` commit, opens the PR from the recovered branch, and emits `default_branch_advanced == true` so `06-write-audit` flags the violation in the audit record.
