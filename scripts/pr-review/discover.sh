#!/usr/bin/env bash
# Find unprocessed review submissions and dispatch them in order.
set -euo pipefail
reviewer=${OPENCODE_REVIEWER_ID:-}
[[ $reviewer =~ ^[1-9][0-9]*$ ]] &&
  { (( ${#reviewer} < 16 )) || { (( ${#reviewer} == 16 )) && [[ $reviewer < 9007199254740992 ]]; }; } || {
    echo '::error::OPENCODE_REVIEWER_ID must be a positive, exactly representable GitHub user ID.'; exit 1;
  }
[[ ${AIDD_REVIEW_ENABLED_AT:-} =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] &&
  jq -en --arg value "$AIDD_REVIEW_ENABLED_AT" \
    'try ($value | fromdateiso8601 | todateiso8601 == $value) catch false' >/dev/null || {
      echo '::error::Set AIDD_REVIEW_ENABLED_AT to a valid UTC timestamp (YYYY-MM-DDTHH:MM:SSZ).'; exit 1;
    }
root="repos/$GH_REPO"
queue="$RUNNER_TEMP/aidd-review-queue.tsv"
: > "$queue"
failed=0
prs=$(gh api --paginate "$root/pulls?state=open&per_page=100" | jq -sc 'add // []')
while IFS= read -r pr; do
  [[ $pr =~ ^[1-9][0-9]*$ ]] || { echo '::error::Invalid pull request ID.'; failed=1; continue; }
  if ! reviews=$(gh api --paginate "$root/pulls/$pr/reviews?per_page=100" | jq -sc 'add // []'); then
    echo "::error::Could not list reviews for PR #$pr."; failed=1; continue
  fi
  if ! jq -e --arg since "$AIDD_REVIEW_ENABLED_AT" --arg reviewer "$reviewer" '
      any(.[]; (.user.id | tostring) == $reviewer and (.submitted_at | type) == "string" and .submitted_at >= $since)
    ' <<<"$reviews" >/dev/null; then continue; fi
  if ! comments=$(gh api --paginate "$root/issues/$pr/comments?per_page=100" | jq -sc 'add // []'); then
    echo "::error::Could not list comments for PR #$pr."; failed=1; continue
  fi
  # Match the reviewer checkpoint format and trust only this app's comments.
  completed=$(jq -c --arg bot "$REVIEW_BOT_LOGIN" '[.[]
    | select(.user.login == $bot and .user.type == "Bot") | . as $comment
    | try (.body | capture("<!-- aidd-review-v1:(?<data>[A-Za-z0-9+/=]+) -->\\s*$").data
      | @base64d | fromjson
      | select(.version == 1 and (.review_id|type) == "string" and (.files|type) == "object")
      | {id: $comment.id, state: .}) catch empty]
    | group_by(.state.review_id) | map(max_by([(.state.revision // 0), .id]))
    | map(select(.state.pending == false) | .state.review_id)' <<<"$comments")
  jq -r --argjson completed "$completed" \
    --arg pr "$pr" --arg since "$AIDD_REVIEW_ENABLED_AT" --arg reviewer "$reviewer" '
    .[] | select((.user.id | tostring) == $reviewer and (.submitted_at | type) == "string" and .submitted_at >= $since)
    | (.id | tostring) as $id | select(($completed | index($id)) == null)
    | [.submitted_at, $id, $pr] | @tsv' <<<"$reviews" >> "$queue"
done < <(jq -r '.[].number' <<<"$prs")

LC_ALL=C sort -t $'\t' -k1,1 -k2,2n -o "$queue" "$queue"
while IFS=$'\t' read -r submitted review pr; do
  [[ -n $submitted ]] || continue
  if ! scripts/pr-review/review.sh "$pr" "$review"; then
    echo "::error::Review $review on PR #$pr failed; check the comment and logs."; failed=1
  fi
done < "$queue"
exit "$failed"
