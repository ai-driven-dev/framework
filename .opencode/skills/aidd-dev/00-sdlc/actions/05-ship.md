# 05 - Ship

Commit and open a change request (pull or merge request) via the project's VCS once the review verdict is `ship`.

## Inputs

- `verdict = ship` (from 04) - required
- `plan_path` (from 02) - required
- `phase_results` (from 03) - optional, drives the commit and change-request body

## Outputs

```yaml
commit_sha: <sha>
change_request_url: <pull or merge request url on the project's VCS host>
```

## Process

1. **Commit.** Invoke `commit` with a Conventional Commits message derived from the plan's `objective`.
2. **Push and open.** Invoke `pull-request` to push the branch and open the change request. Reference `plan_path` in the body.
3. **Return** `commit_sha` and `change_request_url` to the SDLC orchestrator.

## Test

`commit_sha` exists in `git log` of the working branch; `change_request_url` is a non-empty URL pointing to the project's VCS host; the change-request body references `plan_path`.
