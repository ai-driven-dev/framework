#!/usr/bin/env bash
# Review the submitted commit and checkpoint only files the reviewer reports examining.
set -euo pipefail

: "${GH_REPO:?GH_REPO is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GH_REVIEW_TOKEN:?GH_REVIEW_TOKEN is required}"
: "${REVIEW_BOT_LOGIN:?REVIEW_BOT_LOGIN is required}"
: "${REVIEW_MODEL_RUNNER:?REVIEW_MODEL_RUNNER is required}"
reviewer=${OPENCODE_REVIEWER_ID:-}
[[ $reviewer =~ ^[1-9][0-9]*$ ]] &&
  { (( ${#reviewer} < 16 )) || { (( ${#reviewer} == 16 )) && [[ $reviewer < 9007199254740992 ]]; }; } || {
    echo 'OPENCODE_REVIEWER_ID must be a positive, exactly representable GitHub user ID' >&2; exit 2;
  }
pr=${1:-} review_id=${2:-}
[[ $# == 2 && $pr =~ ^[1-9][0-9]*$ && $review_id =~ ^[1-9][0-9]*$ ]] || { echo 'Usage: review.sh PR REVIEW_ID' >&2; exit 2; }
[[ $GH_REPO =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo 'Invalid repository' >&2; exit 2; }
[[ $GH_TOKEN != "$GH_REVIEW_TOKEN" ]] || { echo 'Reviewer token must differ from the publishing token' >&2; exit 1; }
[[ -x $REVIEW_MODEL_RUNNER ]] || { echo 'Review model runner is not executable' >&2; exit 2; }

root="repos/$GH_REPO"
submission=$(gh api "$root/pulls/$pr/reviews/$review_id")
pr_data=$(gh api "$root/pulls/$pr")
jq -e --argjson id "$review_id" --arg reviewer "$reviewer" '.id == $id and (.user.id | tostring) == $reviewer and (.state == "APPROVED" or .state == "CHANGES_REQUESTED" or .state == "COMMENTED" or .state == "DISMISSED")' <<<"$submission" >/dev/null || { echo 'Not a submitted review by the configured reviewer' >&2; exit 1; }
jq -e --arg repo "$GH_REPO" '.state == "open" and .base.repo.full_name == $repo' <<<"$pr_data" >/dev/null || { echo 'PR is closed or belongs to another repository' >&2; exit 1; }
head_sha=$(jq -r '.commit_id // empty' <<<"$submission")
base_sha=$(jq -r '.base.sha // empty' <<<"$pr_data")
submitted_at=$(jq -r '.submitted_at // empty' <<<"$submission")
[[ $head_sha =~ ^[0-9a-f]{40}$ && $base_sha =~ ^[0-9a-f]{40}$ ]] || { echo 'Exact submitted commit or base is unavailable' >&2; exit 1; }
[[ $submitted_at =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || { echo 'Review submission time unavailable' >&2; exit 1; }

# Only this GitHub App's comments can establish a checkpoint.
comments=$(gh api --paginate "$root/issues/$pr/comments?per_page=100" | jq -sc 'add // []')
history=$(jq -c --arg bot "$REVIEW_BOT_LOGIN" '[.[] | select(.user.login == $bot and .user.type == "Bot") | . as $comment | try (.body | capture("<!-- aidd-review-v1:(?<data>[A-Za-z0-9+/=]+) -->\\s*$").data | @base64d | fromjson | select(.version == 1 and (.review_id|type) == "string" and (.files|type) == "object") | {id: $comment.id, state: .}) catch empty] | sort_by([(.state.revision // 0), .id])' <<<"$comments")
existing=$(jq -c --arg id "$review_id" '[.[] | select(.state.review_id == $id)] | last // null' <<<"$history")
if jq -e '. != null and .state.pending == false' <<<"$existing" >/dev/null; then
  echo "Review $review_id was already published"
  exit 0
fi
previous=$(jq -c 'last.state.files // {}' <<<"$history")
latest_at=$(jq -r 'last.state.latest_at // ""' <<<"$history")
latest_id=$(jq -r 'last.state.latest_id // "0"' <<<"$history")
revision=$(jq -r 'last.state.revision // 0' <<<"$history")
comment_id=$(jq -r '.id // empty' <<<"$existing")
prior_reports=$(jq -c 'if .state.pending == true and (.state.reports | type) == "array" then .state.reports else [] end' <<<"$existing")
[[ $revision =~ ^[0-9]+$ && $latest_id =~ ^[0-9]+$ && ( -z $comment_id || $comment_id =~ ^[1-9][0-9]*$ ) ]] || { echo 'Invalid review checkpoint' >&2; exit 1; }
revision=$((revision + 1))

work=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/aidd-review.XXXXXXXX")
cleanup() { if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi; }
trap cleanup EXIT
mkdir -p "$work/input/source" "$work/input/review-input"
manifest="$work/manifest.json"
printf '[]\n' > "$manifest"
# An older queued review must not replace a newer checkpoint.
next='{}' notes='[]' report=''
if [[ -n $latest_at && ( $submitted_at < $latest_at || ( $submitted_at == "$latest_at" && $review_id -lt $latest_id ) ) ]]; then
  next=$previous
  report='This submission predates the latest review checkpoint. Submit a new review to review the current diff.'
else
  clone_url=$(gh api "$root" --jq .clone_url)
  export GIT_TERMINAL_PROMPT=0 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_NO_REPLACE_OBJECTS=1
  git -C "$work/input/source" init -q
  if ! git -C "$work/input/source" -c core.hooksPath=/dev/null -c credential.helper='!gh auth git-credential' fetch -q --no-tags "$clone_url" "$base_sha" "$head_sha"; then
    echo 'Exact submitted commit or base could not be fetched' >&2; exit 1
  fi
  merge_base=$(git -C "$work/input/source" merge-base "$base_sha" "$head_sha") || { echo 'Merge base is unavailable' >&2; exit 1; }
  if ! git -C "$work/input/source" -c core.symlinks=false -c core.hooksPath=/dev/null -c core.attributesFile=/dev/null checkout --detach --force -q "$head_sha"; then
    echo 'Exact submitted commit could not be checked out' >&2; exit 1
  fi
  git -C "$work/input/source" config core.symlinks false
  git -C "$work/input/source" config core.hooksPath /dev/null
  git -C "$work/input/source" config core.attributesFile /dev/null
  jq -r --argjson submission "$submission" '"Title: " + (.title // "") + "\n\nDescription:\n" + (.body // "") + "\n\nSubmitted review:\n" + ($submission.body // "") | gsub("\\u0000"; "[NUL]")' <<<"$pr_data" > "$work/input/review-input/pr-context.txt"

  git -C "$work/input/source" --literal-pathspecs diff --no-ext-diff --no-textconv --name-status -z -M "$merge_base" "$head_sha" > "$work/paths"
  while IFS= read -r -d '' status && IFS= read -r -d '' path; do
    old_path=''
    if [[ $status == R* || $status == C* ]]; then
      old_path=$path
      IFS= read -r -d '' path || { echo 'Invalid renamed path' >&2; exit 1; }
    fi
    if ! printf %s "$path" | iconv -f UTF-8 -t UTF-8 >/dev/null 2>&1; then
      notes=$(jq -cn --argjson notes "$notes" --arg path "$(printf '%q' "$path")" '$notes + [{path:$path,reason:"Path is not valid UTF-8."}]')
      continue
    fi
    paths=("$path")
    [[ -z $old_path ]] || paths+=("$old_path")
    git -C "$work/input/source" --literal-pathspecs diff --no-ext-diff --no-textconv --full-index -M "$merge_base" "$head_sha" -- "${paths[@]}" > "$work/patch"
    [[ -s $work/patch ]] || { echo "Unable to produce diff for $path" >&2; exit 1; }
    git -C "$work/input/source" --literal-pathspecs diff --no-ext-diff --no-textconv --raw -z -M "$merge_base" "$head_sha" -- "${paths[@]}" > "$work/raw"
    IFS= read -r -d '' raw < "$work/raw" || { echo "Unable to inspect diff for $path" >&2; exit 1; }
    if [[ ${raw:1:6} == 160000 || ${raw:8:6} == 160000 ]]; then
      notes=$(jq -cn --argjson notes "$notes" --arg path "$path" '$notes + [{path:$path,reason:"Submodule contents are unavailable."}]')
      continue
    fi
    git -C "$work/input/source" --literal-pathspecs diff --no-ext-diff --no-textconv --numstat -z -M "$merge_base" "$head_sha" -- "${paths[@]}" > "$work/stats"
    if [[ $(head -c 2 "$work/stats") == $'-\t' ]]; then
      notes=$(jq -cn --argjson notes "$notes" --arg path "$path" '$notes + [{path:$path,reason:"Binary diff cannot be reviewed as text."}]')
      continue
    fi
    fingerprint=$(sha256sum "$work/patch" | awk '{print $1}')
    if jq -e --arg path "$path" --arg hash "$fingerprint" '.[$path] == $hash' <<<"$previous" >/dev/null; then
      next=$(jq -cn --argjson next "$next" --arg path "$path" --arg hash "$fingerprint" '$next + {($path):$hash}')
    else
      jq -c --arg path "$path" --arg status "$status" --arg hash "$fingerprint" '. + [{path:$path,status:$status,fingerprint:$hash}]' "$manifest" > "$work/manifest-next"
      mv "$work/manifest-next" "$manifest"
    fi
  done < "$work/paths"

  # A new submission can add feedback even when every file is unchanged.
  output="$work/model-output.json"
  : > "$output"
  if ! env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" LANG="${LANG:-C.UTF-8}" \
    GH_REPO="$GH_REPO" REVIEW_PR="$pr" REVIEW_BASE="$merge_base" REVIEW_HEAD="$head_sha" GH_REVIEW_TOKEN="$GH_REVIEW_TOKEN" \
    OPENCODE_REVIEW_MODEL="${OPENCODE_REVIEW_MODEL:-openai/gpt-6.1-terra#medium}" \
    "$REVIEW_MODEL_RUNNER" "$work/input" "$manifest" "$output"; then
    echo 'Reviewer failed; no new files were checkpointed' >&2; exit 1
  fi
  if ! jq -e --slurpfile targets "$manifest" '
    (.report | type == "string" and length > 0) and
    (.reviewed | type == "array" and all(.[]; type == "string")) and
    ((.reviewed | unique | length) == (.reviewed | length)) and
    all(.reviewed[]; . as $name | any($targets[0][]; .path == $name))
  ' "$output" >/dev/null; then
    echo 'Reviewer returned an invalid report; no new files were checkpointed' >&2; exit 1
  fi
  report=$(jq -r .report "$output")
  while IFS= read -r item; do
    path=$(jq -rj '.path, "\u0001"' <<<"$item"); path=${path%$'\001'}
    fingerprint=$(jq -r '.fingerprint' <<<"$item")
    if jq -e --arg path "$path" '.reviewed | index($path) != null' "$output" >/dev/null; then
      next=$(jq -cn --argjson next "$next" --arg path "$path" --arg hash "$fingerprint" '$next + {($path):$hash}')
    else
      notes=$(jq -cn --argjson notes "$notes" --arg path "$path" '$notes + [{path:$path,reason:"Reviewer did not report a complete review."}]')
    fi
  done < <(jq -c '.[]' "$manifest")
  latest_at=$submitted_at latest_id=$review_id
fi

state=$(jq -cn --arg id "$review_id" --arg head "$head_sha" --arg base "$base_sha" --arg latest_at "$latest_at" --arg latest_id "$latest_id" --argjson revision "$revision" --argjson files "$next" '{version:1,revision:$revision,review_id:$id,head:$head,base:$base,latest_at:$latest_at,latest_id:$latest_id,files:$files,pending:false}')
marker=$(printf %s "$state" | base64 | tr -d '\n')
{
  printf '## OpenCode review\n\nSubmitted commit: `%s`.\n\n' "$head_sha"
  jq -r '.[] | ., ""' <<<"$prior_reports"
  printf '%s\n\n' "$report"
  if [[ $(jq 'length' <<<"$notes") != 0 ]]; then
    printf '**Review incomplete:** submit a new review to retry these files.\n\n'
    jq -r '.[] | "- " + (.path | @json) + ": " + .reason' <<<"$notes"
    printf '\n'
  fi
  printf '<!-- aidd-review-v1:%s -->\n' "$marker"
} > "$work/comment.md"
(( $(wc -c < "$work/comment.md") <= 60000 )) || { echo 'Review output exceeds the GitHub comment limit; nothing was published' >&2; exit 1; }
jq -n --rawfile body "$work/comment.md" '{body:$body}' > "$work/comment.json"
if [[ -n $comment_id ]]; then
  gh api -X PATCH "$root/issues/comments/$comment_id" --input "$work/comment.json" >/dev/null
else
  gh api -X POST "$root/issues/$pr/comments" --input "$work/comment.json" >/dev/null
fi
