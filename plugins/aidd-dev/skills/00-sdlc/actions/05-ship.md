# 05 - Ship

Commit and open the pull request once the review verdict is `ship`.

## Inputs

- `verdict = ship` (from 04) - required
- `plan_path` (from 02) - required
- `phase_results` (from 03) - optional, drives the commit/PR body

## Outputs

```yaml
commit_sha: <sha>
pr_url: <github pull-request url>
```

## Process

1. **Commit.** Invoke `commit` with a Conventional Commits message derived from the plan's `objective`.
2. **Push and PR.** Invoke `pull-request` to push the branch and open the pull request. Reference `plan_path` in the PR body.
3. **Return** `commit_sha` and `pr_url` to the SDLC orchestrator.

## Test

`commit_sha` exists in `git log` of the working branch; `pr_url` is a valid GitHub PR URL; the PR body references `plan_path`.
