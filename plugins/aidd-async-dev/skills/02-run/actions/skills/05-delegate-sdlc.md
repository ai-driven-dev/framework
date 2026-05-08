# 05 -- Delegate SDLC

Hands the implementation off to the SDLC capability discovered at runtime, on a dedicated feature branch, with a strict no-push-to-main contract.

## Inputs

- `issue` (required) -- the locked issue object
- `run_id` (required) -- run identifier from `03-acquire-lock`
- `discovered_skill` (required) -- skill name returned by `04-check-sdlc`
- `config` (required) -- parsed `.claude/aidd-async-dev.json`

## Outputs

```json
{
  "branch": "feat/issue-<n>-<slug>",
  "pr_number": 117,
  "pr_url": "https://github.com/org/repo/pull/117",
  "tests_passed": true,
  "duration_seconds": 612
}
```

## Depends on

- `04-check-sdlc`

## Process

1. Compute a feature branch name: `feat/issue-<issue.number>-<kebab-slug-of-title>` (truncate slug to 40 chars). The branch must not equal the repo default branch.
2. Create and checkout the branch from the current HEAD: `git checkout -b "$BRANCH"`.
3. Compose the delegation prompt with these strict constraints, in order:
   - Work only on the current branch (`<BRANCH>`); never push to `main` or any default branch.
   - Open a Pull Request from `<BRANCH>` against the default branch; never merge it.
   - Reference the issue with `Closes #<n>` in the PR body so GitHub auto-links it.
   - Test command must pass before opening the PR.
   - Include the issue title, body, labels.
4. Invoke the skill named in `discovered_skill` via the `Skill` tool with that prompt. Read the skill name from input; never hardcode.
5. Capture the result: branch, PR number, test outcome, duration. If the SDLC capability returned but no PR exists (or commits landed on default branch), abort with a structured error -- this is treated as a contract violation and routed to `06-write-audit` as a failure.
6. Forward the structured result to `06-write-audit`. Do not transition labels here; that happens in `06`.

## Test

After running against a real "ready" issue: `gh pr view <pr_number> --json number,headRefName,baseRefName` returns the PR with `headRefName == <BRANCH>` (not the default branch), `baseRefName == <default branch>`, and the PR body contains `Closes #<issue.number>`. `git log <default branch>` does NOT contain commits authored by the bot for this run id.
