#!/usr/bin/env bash
# Publish the agent response and its explicitly requested changes.
set -euo pipefail
post_reply() {
  if [ "$GITHUB_EVENT_NAME" = "pull_request_review_comment" ]; then
    root_comment=$(jq -er '.comment.in_reply_to_id // .comment.id' "$GITHUB_EVENT_PATH")
    [[ $root_comment =~ ^[1-9][0-9]*$ ]]
    jq -Rs '{body: .}' | gh api --method POST \
      "repos/$REPO/pulls/$NUMBER/comments/$root_comment/replies" --input - --silent
  else
    gh issue comment "$NUMBER" --repo "$REPO" --body-file -
  fi
}
if [ "$AGENT_OUTCOME" != "success" ]; then
  if [ -f "$RUNNER_TEMP/prompt.md" ] && [ "$(wc -c < "$RUNNER_TEMP/prompt.md")" -gt 400000 ]; then
    printf 'OpenCode did not run: the request and context exceed 400,000 bytes. Please shorten the request or PR context.\n' | post_reply
  else
    printf 'OpenCode did not finish. Logs: %s\n' "$RUN_URL" | post_reply
  fi
  exit 0
fi

footer="No file changed."
if [ -n "$(git status --porcelain)" ]; then
  : "${DEFAULT_BRANCH:?DEFAULT_BRANCH is required}"
  BASE_BRANCH=${BASE_BRANCH:-$DEFAULT_BRANCH}
  for value in "$DEFAULT_BRANCH" "$BASE_BRANCH" "$BRANCH"; do
    [[ $value != -* && $(git check-ref-format --branch "$value" 2>/dev/null) == "$value" ]] || {
      echo '::error::Invalid configured or target branch.' >&2; exit 1;
    }
  done
  case "$BRANCH" in
    "$DEFAULT_BRANCH" | "$BASE_BRANCH")
      echo '::error::Refusing to commit to a protected branch.' >&2; exit 1 ;;
  esac
  bot_id="$(gh api "users/${APP_SLUG}%5Bbot%5D" --jq .id)"
  git config user.name "${APP_SLUG}[bot]"
  git config user.email "${bot_id}+${APP_SLUG}[bot]@users.noreply.github.com"
  gh auth setup-git
  git switch -C "$BRANCH"
  git add -A
  git commit --quiet -m "chore: apply opencode request from #$NUMBER"
  git push --quiet origin "HEAD:refs/heads/$BRANCH"
  footer="Pushed to \`$BRANCH\`."
  if [ "$IS_PR" != "true" ]; then
    url="$(gh pr list --repo "$REPO" --head "$BRANCH" --json url --jq '.[0].url // ""')"
    if [ -z "$url" ]; then
      url="$(gh pr create --repo "$REPO" --base "$BASE_BRANCH" --head "$BRANCH" \
        --title "chore: apply opencode request from #$NUMBER" \
        --body "Refs #$NUMBER. Opened by the OpenCode agent workflow.")"
    fi
    footer="Pull request: $url"
  fi
fi
printf '%s\n\n---\n%s · [run](%s)\n' "$(cat "$RUNNER_TEMP/reply.md")" "$footer" "$RUN_URL" \
  | post_reply
