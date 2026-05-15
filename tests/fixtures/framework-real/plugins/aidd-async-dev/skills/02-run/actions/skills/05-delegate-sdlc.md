# 05 -- Delegate SDLC

Hands the implementation off to the SDLC capability discovered at runtime.

## Inputs

- `issue` (required) -- the locked issue object
- `run_id` (required) -- run identifier from `03-acquire-lock`
- `discovered_skill` (required) -- skill name returned by `04-check-sdlc`
- `config` (required) -- parsed `.claude/aidd-async-dev.json`

## Outputs

```json
{
  "branch": "aidd-async/i42",
  "pr_number": 117,
  "pr_url": "https://github.com/org/repo/pull/117",
  "tests_passed": true,
  "duration_seconds": 612
}
```

## Depends on

- `04-check-sdlc`

## Process

1. Determine the working scope:
   - If `config.monorepo_scope == "codeowners"` and a CODEOWNERS file exists: parse the issue body and labels for path hints; restrict the SDLC working set to matching CODEOWNERS paths.
   - Otherwise the whole repo is in scope.
2. Compose the delegation prompt: the issue title, body, labels, the working scope, and the constraint "open a PR; do not merge".
3. Invoke the skill named in `discovered_skill` via the `Skill` tool with that prompt. Do not hardcode the skill name in this action's logic; always read it from the input.
4. Capture the result: branch, PR number, test outcome, duration.
5. Forward the structured result to `06-write-audit`. Do not remove the `ai:running` label here.

## Test

After running against a real "ready" issue: `gh pr view <pr_number> --json number,headRefName` returns the PR with `headRefName == branch`, and the issue body or PR body links back to the issue (e.g. `Closes #42`).
