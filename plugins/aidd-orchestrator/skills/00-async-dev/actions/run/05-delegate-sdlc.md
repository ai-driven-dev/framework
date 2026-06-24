# 05 -- Delegate SDLC

Invoke the SDLC capability with the issue request, then verify the outcome by observing the real state of git and the VCS host, never by parsing the SDLC's return shape.

## Input
- `issue` -- the locked issue object
- `run_id` -- identifier from `03-acquire-lock`
- `discovered_skill` -- skill name from `04-check-sdlc`
- `config` -- parsed `.claude/aidd-orchestrator.json`
- `trigger_kind` (optional) -- `label` or `comment`
- `trigger_comment_url` (optional) -- when `trigger_kind = comment`

## Output
```json
{
  "default_before": "<sha>",
  "default_after": "<sha>",
  "default_drift_shas": ["<sha>", "..."],
  "current_branch": "<branch>",
  "branch_commits": ["<sha>", "..."],
  "pr_number": 117,
  "pr_url": "https://.../pull/117",
  "pr_decoration_applied": true,
  "recovery_applied": false,
  "outcome": "success | recovered | blocked"
}
```

Every field is the result of an observation against git or the VCS host. None is parsed from the SDLC's return text.

## Depends on

- `04-check-sdlc`

## Process

1. **Baseline.** `git fetch origin`. Record `default_before = git rev-parse origin/<default>`. Resolve `<default>` from `git symbolic-ref refs/remotes/origin/HEAD`.
2. **Compose the delegation prompt.** A single free-text `request`. No orchestrator vocabulary, no branch instructions, no `Closes #N`, no PR-title format, no "do NOT" lists. The SDLC is fully agnostic; it must run identically when called by a human or by this orchestrator. Include:
   - The issue title and body verbatim.
   - Human comments authored on the issue after the previous bot activity, separated by `---`. Fetch via `gh api repos/$GITHUB_REPOSITORY/issues/<n>/comments --jq '[.[] | select(.user.type != "Bot")]'`. If `trigger_kind = comment`, place that comment first.
3. **Invoke the SDLC** via the `Skill` tool, exactly once, with the skill name in `discovered_skill` and the prompt above as `args`. The orchestrator MUST NOT mutate working files itself.
4. **Observe reality** after the SDLC returns. Do not read its output text; query git and the VCS host:
   ```bash
   git fetch origin
   default_after=$(git rev-parse origin/<default>)
   default_drift_shas=$(git log --format=%H "$default_before".."$default_after")
   current_branch=$(git rev-parse --abbrev-ref HEAD)
   branch_commits=$(git log --format=%H "origin/<default>"..HEAD 2>/dev/null || echo "")
   pr_number=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$current_branch" --state open --json number --jq '.[0].number // empty')
   ```
5. **Decide `outcome`** purely from observation:
   | default_drift | pr_number | branch_commits | outcome   | follow-up                          |
   | ------------- | --------- | -------------- | --------- | ---------------------------------- |
   | empty         | non-empty | non-empty      | success   | step 8 only                        |
   | non-empty     | non-empty | non-empty      | recovered | recover (step 6), then step 8      |
   | empty         | empty     | non-empty      | success   | open PR (step 7), then step 8      |
   | non-empty     | empty     | any            | recovered | recover (step 6), open PR (step 7) |
   | empty         | empty     | empty          | blocked   | skip steps 6-8                     |
6. **Recover.** When `default_drift_shas` is non-empty, the SDLC pushed to `<default>`. Cherry-pick the drift commits onto `current_branch` (or a fresh `feat/issue-<n>-<slug>` if none exists), push, then `git revert --no-edit` each drift sha on `<default>` and push. Set `recovery_applied = true`.
7. **Open a PR ourselves** when `pr_number` is empty but `branch_commits` is non-empty: `pr_url=$(gh pr create --base <default> --head $current_branch --title "feat: <issue title> (#<n>)" --body "<body>")`. Capture `pr_number` from the URL.
8. **Decorate the PR** so the VCS host auto-links the issue:
   ```bash
   current_body=$(gh pr view "$pr_number" --repo "$GITHUB_REPOSITORY" --json body --jq .body)
   case "$current_body" in
     *"Closes #<n>"*|*"Fixes #<n>"*|*"Resolves #<n>"*) ;;  # already linked, no-op
     *) gh pr edit "$pr_number" --repo "$GITHUB_REPOSITORY" --body "$current_body\n\nCloses #<n>" ;;
   esac
   ```
   Set `pr_decoration_applied = true`.
9. **Forward** the structured output above to `06-write-audit`. Lifecycle artifacts (audit JSON, check run, label transition, completion marker) are produced post-Claude by the workflow job; this action only prepares the data.

## Test

```bash
# 1. No commits remain on default that originate from this run.
git fetch origin
post=$(git rev-parse origin/<default>)
diff_count=$(git log --format=%H "$default_before".."$post" | wc -l | tr -d ' ')
[ "$diff_count" = "0" ] || [ "$recovery_applied" = "true" ] && echo "OK no_drift" || echo "FAIL drift"

# 2. The outcome is one of the valid enum values.
case "$outcome" in success|recovered|blocked) echo "OK outcome_$outcome" ;; *) echo "FAIL outcome_$outcome" ;; esac

# 3. When outcome is success or recovered: a PR exists and links the issue.
if [ "$outcome" != "blocked" ]; then
  body=$(gh pr view "$pr_number" --repo "$GITHUB_REPOSITORY" --json body --jq .body)
  case "$body" in *"Closes #<n>"*|*"Fixes #<n>"*|*"Resolves #<n>"*) echo "OK linked" ;; *) echo "FAIL not_linked" ;; esac
fi
```
