#!/usr/bin/env bash
# Resolve the trusted target branch for a comment request.
set -euo pipefail
if [ "$IS_PR" = "true" ]; then
  pr="$(gh pr view "$NUMBER" --repo "$REPO" --json headRefName,isCrossRepository)"
  branch="$(jq -r .headRefName <<<"$pr")"
  if [ "$(jq -r .isCrossRepository <<<"$pr")" = "true" ]; then
    echo "::error::Pull requests from forks are not supported."
    exit 1
  fi
  case "$branch" in
    main | next)
      echo "::error::Refusing to commit to $branch."
      exit 1
      ;;
  esac
  ref="$branch"
else
  branch="chore/opencode-issue-$NUMBER"
  # A later request on the same issue continues the branch the first one opened.
  if gh api "repos/$REPO/branches/$branch" --silent 2>/dev/null; then ref="$branch"; else ref=next; fi
fi
echo "branch=$branch" >> "$GITHUB_OUTPUT"
echo "ref=$ref" >> "$GITHUB_OUTPUT"
