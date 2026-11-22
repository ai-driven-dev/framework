#!/usr/bin/env bash
# Verify trusted base selection and protected branches in conversation flows.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd -P)
work=$(mktemp -d "${TMPDIR:-/tmp}/aidd-conversation-test.XXXXXXXX")
trap 'if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi' EXIT
mkdir -p "$work/bin" "$work/runtime"
export REAL_GIT=$(command -v git)
export GH_CALLS="$work/gh-calls" GIT_CALLS="$work/git-calls"
export REPO=example/project NUMBER=77 DEFAULT_BRANCH=trunk BASE_BRANCH=develop
export GITHUB_OUTPUT="$work/output" RUNNER_TEMP="$work/runtime" APP_SLUG=test-bot
export GITHUB_EVENT_NAME=issue_comment AGENT_OUTCOME=success RUN_URL=https://example.invalid/run
export PATH="$work/bin:$PATH"
printf 'done\n' > "$RUNNER_TEMP/reply.md"

cat > "$work/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' CALL "$@" >> "$GH_CALLS"
if [[ ${1:-} == pr && ${2:-} == view ]]; then
  jq -n --arg branch "${PR_BRANCH:-feature/change}" --argjson fork "${PR_FORK:-false}" '{headRefName:$branch,isCrossRepository:$fork}'
elif [[ ${1:-} == api && ${2:-} == repos/*/branches/* ]]; then
  [[ ${ISSUE_BRANCH_EXISTS:-false} == true ]]
elif [[ ${1:-} == api && ${2:-} == users/* ]]; then
  printf '123\n'
elif [[ ${1:-} == pr && ${2:-} == create ]]; then
  printf 'https://example.invalid/pull/1\n'
elif [[ ${1:-} == issue && ${2:-} == comment ]]; then
  cat >/dev/null
fi
GH
cat > "$work/bin/git" <<'GIT'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' CALL "$@" >> "$GIT_CALLS"
case ${1:-} in
  check-ref-format) exec "$REAL_GIT" "$@" ;;
  status) printf ' M file\n' ;;
esac
GIT
chmod +x "$work/bin/gh" "$work/bin/git"

# An issue starts from the configured base, or continues its existing branch.
: > "$GITHUB_OUTPUT"
IS_PR=false ISSUE_BRANCH_EXISTS=false bash "$root/scripts/pr-review/conversation-target.sh"
grep -Fxq 'ref=develop' "$GITHUB_OUTPUT"
grep -Fxq 'branch=chore/opencode-issue-77' "$GITHUB_OUTPUT"
: > "$GITHUB_OUTPUT"
IS_PR=false BASE_BRANCH='' ISSUE_BRANCH_EXISTS=false bash "$root/scripts/pr-review/conversation-target.sh"
grep -Fxq 'ref=trunk' "$GITHUB_OUTPUT"
: > "$GITHUB_OUTPUT"
IS_PR=false ISSUE_BRANCH_EXISTS=true bash "$root/scripts/pr-review/conversation-target.sh"
grep -Fxq 'ref=chore/opencode-issue-77' "$GITHUB_OUTPUT"

# Neither protected branches nor an external fork may become a push target.
for protected in trunk develop; do
  if IS_PR=true PR_BRANCH="$protected" bash "$root/scripts/pr-review/conversation-target.sh" >/dev/null 2>&1; then
    echo "Protected branch accepted: $protected" >&2; exit 1
  fi
done
if IS_PR=true PR_FORK=true bash "$root/scripts/pr-review/conversation-target.sh" >/dev/null 2>&1; then
  echo 'Fork accepted' >&2; exit 1
fi
if IS_PR=true PR_BRANCH=--unsafe bash "$root/scripts/pr-review/conversation-target.sh" >/dev/null 2>&1; then
  echo 'Invalid target branch accepted' >&2; exit 1
fi
for allowed in main next feature/change; do
  : > "$GITHUB_OUTPUT"
  IS_PR=true PR_BRANCH="$allowed" bash "$root/scripts/pr-review/conversation-target.sh"
  grep -Fxq "ref=$allowed" "$GITHUB_OUTPUT"
done

# Invalid base names must never reach a GitHub output or a PR creation command.
for invalid in --unsafe $'bad\nbranch'; do
  : > "$GITHUB_OUTPUT"
  if IS_PR=false BASE_BRANCH="$invalid" bash "$root/scripts/pr-review/conversation-target.sh" >/dev/null 2>&1; then
    echo 'Invalid base branch accepted' >&2; exit 1
  fi
  [[ ! -s $GITHUB_OUTPUT ]]
done

: > "$GH_CALLS"
IS_PR=false BRANCH=chore/opencode-issue-77 bash "$root/scripts/pr-review/conversation-reply.sh"
awk 'previous == "--base" && $0 == "develop" { found=1 } { previous=$0 } END { exit !found }' "$GH_CALLS"

# The publishing boundary must also refuse a direct push to a protected branch.
for protected in trunk develop; do
  : > "$GIT_CALLS"
  if IS_PR=true BRANCH="$protected" bash "$root/scripts/pr-review/conversation-reply.sh" >/dev/null 2>&1; then
    echo "Protected publishing branch accepted: $protected" >&2; exit 1
  fi
  if grep -Fxq push "$GIT_CALLS"; then echo 'Protected branch reached push' >&2; exit 1; fi
done
for allowed in main next; do
  : > "$GIT_CALLS"
  IS_PR=true BRANCH="$allowed" bash "$root/scripts/pr-review/conversation-reply.sh"
  grep -Fxq push "$GIT_CALLS"
done
# The framework's own main/next remain protected when they are configured.
for protected in main next; do
  if IS_PR=true DEFAULT_BRANCH=main BASE_BRANCH=next PR_BRANCH="$protected" bash "$root/scripts/pr-review/conversation-target.sh" >/dev/null 2>&1; then
    echo "Configured framework branch accepted: $protected" >&2; exit 1
  fi
  if IS_PR=true DEFAULT_BRANCH=main BASE_BRANCH=next BRANCH="$protected" bash "$root/scripts/pr-review/conversation-reply.sh" >/dev/null 2>&1; then
    echo "Configured framework publishing branch accepted: $protected" >&2; exit 1
  fi
done
echo 'Conversation branch checks passed'
