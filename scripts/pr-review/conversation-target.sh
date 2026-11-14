#!/usr/bin/env bash
# Resolve the trusted target branch for a comment request.
set -euo pipefail
: "${DEFAULT_BRANCH:?DEFAULT_BRANCH is required}"
BASE_BRANCH=${BASE_BRANCH:-$DEFAULT_BRANCH}
for value in "$DEFAULT_BRANCH" "$BASE_BRANCH"; do
  [[ $value != -* && $(git check-ref-format --branch "$value" 2>/dev/null) == "$value" ]] || {
    echo '::error::Invalid configured branch.'; exit 1;
  }
done
[[ $NUMBER =~ ^[1-9][0-9]*$ && $REPO =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || {
  echo '::error::Invalid repository or issue number.'; exit 1;
}
if [ "$IS_PR" = "true" ]; then
  pr="$(gh pr view "$NUMBER" --repo "$REPO" --json headRefName,isCrossRepository)"
  branch="$(jq -r .headRefName <<<"$pr")"
  if [ "$(jq -r .isCrossRepository <<<"$pr")" = "true" ]; then
    echo "::error::Pull requests from forks are not supported."
    exit 1
  fi
else
  branch="chore/opencode-issue-$NUMBER"
fi
[[ $branch != -* && $(git check-ref-format --branch "$branch" 2>/dev/null) == "$branch" ]] || {
  echo '::error::Invalid target branch.'; exit 1;
}
case "$branch" in
  "$DEFAULT_BRANCH" | "$BASE_BRANCH")
    echo "::error::Refusing to commit to $branch."
    exit 1
    ;;
esac
if [ "$IS_PR" = "true" ]; then
  ref="$branch"
else
  # A later request on the same issue continues the branch the first one opened.
  if gh api "repos/$REPO/branches/$branch" --silent 2>/dev/null; then ref="$branch"; else ref="$BASE_BRANCH"; fi
fi
echo "branch=$branch" >> "$GITHUB_OUTPUT"
echo "ref=$ref" >> "$GITHUB_OUTPUT"
