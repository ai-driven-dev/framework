#!/usr/bin/env bash
set -euo pipefail

# Review one GitHub submission. The model runner is isolated from the GitHub token.
: "${GH_REPO:?GH_REPO is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${REVIEW_BOT_LOGIN:?REVIEW_BOT_LOGIN is required}"
: "${REVIEW_MODEL_RUNNER:?REVIEW_MODEL_RUNNER is required}"
pr=${1:-} review_id=${2:-}
[[ $# == 2 && $pr =~ ^[1-9][0-9]*$ && $review_id =~ ^[1-9][0-9]*$ ]] || { echo 'Usage: review.sh PR REVIEW_ID' >&2; exit 2; }
[[ $GH_REPO =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo 'Invalid repository' >&2; exit 2; }
[[ -x $REVIEW_MODEL_RUNNER ]] || { echo 'Review model runner is not executable' >&2; exit 2; }
state_home=${XDG_STATE_HOME:-${HOME:?HOME is required}/.local/state}
[[ $state_home == /* ]] || { echo 'XDG_STATE_HOME must be absolute' >&2; exit 2; }
state_root="$state_home/aidd-pr-review"
review_key=$(jq -cn --arg repo "$GH_REPO" --arg pr "$pr" --arg id "$review_id" '[$repo,$pr,$id]' | sha256sum | awk '{print $1}')
review_drafts="$state_root/$review_key"
discard() {
  [[ -e $1 ]] || return 0
  if [[ $(uname -s) == Darwin ]]; then trash "$1"; else rm -rf -- "$1"; fi
}
save_draft() (
  umask 077
  mkdir -p "$review_drafts"
  chmod 700 "$state_root" "$review_drafts"
  temp=$(mktemp "$review_drafts/.draft.XXXXXXXX")
  cat "$1" > "$temp"
  chmod 600 "$temp"
  mv -f "$temp" "$2"
)

root="repos/$GH_REPO"
submission=$(gh api "$root/pulls/$pr/reviews/$review_id")
pr_data=$(gh api "$root/pulls/$pr")
jq -e --argjson id "$review_id" '.id == $id and .user.id == 8973343 and (.state == "APPROVED" or .state == "CHANGES_REQUESTED" or .state == "COMMENTED" or .state == "DISMISSED")' <<<"$submission" >/dev/null || { echo 'Not a submitted review by Alex' >&2; exit 1; }
jq -e --arg repo "$GH_REPO" '.state == "open" and .base.repo.full_name == $repo' <<<"$pr_data" >/dev/null || { echo 'PR is closed or belongs to another repository' >&2; exit 1; }
head_sha=$(jq -r '.commit_id // empty' <<<"$submission")
base_sha=$(jq -r '.base.sha // empty' <<<"$pr_data")
submitted_at=$(jq -r '.submitted_at // empty' <<<"$submission")
[[ $submitted_at =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] || { echo 'Review submission time unavailable' >&2; exit 1; }

work=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/aidd-review.XXXXXXXX")
cleanup() {
  if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi
}
trap cleanup EXIT
mkdir -p "$work/repo" "$work/input/source" "$work/input/review-input"
# Context is untrusted data. Wrap long lines so OpenCode's read tool cannot
# silently clip them; bound both total characters and the number of lines.
jq -c '
  def wrap: split("\n") | map(
    if length == 0 then [""] else
      explode as $chars | [range(0; ($chars|length); 398) as $i |
        (if $i == 0 then "" else "↳ " end) + ($chars[$i:$i+398] | implode)]
    end) | add // [];
  ("Title: " + (.title // "") + "\n\nDescription:\n" + (.body // "") | gsub("\u0000"; "[NUL]")) as $raw |
  ($raw[0:10000] | wrap) as $lines |
  (($raw|length) > 10000 or ($lines|length) > 995) as $truncated |
  {truncated:$truncated, text:(($lines[0:995] | join("\n")) + (if $truncated then "\n\n[PR context truncated to fit review limits.]" else "" end))}
' <<<"$pr_data" > "$work/context.json"
context_truncated=$(jq -r '.truncated' "$work/context.json")
context_token=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
{
  printf 'AIDD_CONTEXT_BEGIN_%s\n' "$context_token"
  jq -r '.text' "$work/context.json"
  printf 'AIDD_CONTEXT_END_%s\n' "$context_token"
} > "$work/input/review-input/pr-context.txt"
# Only markers in comments from our GitHub App are authoritative. The final
# marker is both the publication record and the state for the next submission.
comments=$(gh api --paginate "$root/issues/$pr/comments?per_page=100" | jq -sc 'add // []')
history=$(jq -c --arg bot "$REVIEW_BOT_LOGIN" '[.[] | select(.user.login == $bot and .user.type == "Bot") | . as $comment | try (.body | capture("<!-- aidd-review-v1:(?<data>[A-Za-z0-9+/=]+) -->\\s*$").data | @base64d | fromjson | select(.version == 1 and (.review_id|type) == "string" and (.files|type) == "object") | {id: $comment.id, state: .}) catch empty] | sort_by([(.state.revision // 0), .id])' <<<"$comments")
existing=$(jq -c --arg id "$review_id" '[.[] | select(.state.review_id == $id)] | last // null' <<<"$history")
if jq -e '. != null and .state.pending == false' <<<"$existing" >/dev/null; then
  discard "$review_drafts"
  echo "Review $review_id was already published"
  exit 0
fi
previous=$(jq -c 'last.state.files // {}' <<<"$history")
latest_at=$(jq -r 'last.state.latest_at // ""' <<<"$history")
latest_id=$(jq -r 'last.state.latest_id // "0"' <<<"$history")
revision=$(jq -r 'last.state.revision // 0' <<<"$history")
[[ $revision =~ ^[0-9]+$ ]] || { echo 'Invalid review checkpoint revision' >&2; exit 1; }
revision=$((revision + 1))
comment_id=$(jq -r '.id // empty' <<<"$existing")
[[ -z $comment_id || $comment_id =~ ^[1-9][0-9]*$ ]] || { echo 'Invalid prior comment ID' >&2; exit 1; }
next='{}' notes='[]' failed=0
# A partial review may be retried after successful batches. Keep their reports
# with that submission until the final comment contains all findings.
reports=$(jq -c 'if .state.pending == true and (.state.reports | type) == "array" then .state.reports else [] end' <<<"$existing")
pending_files=$(jq -c 'if .state.pending == true and (.state.pending_files | type) == "object" then .state.pending_files else {} end' <<<"$existing")
published_files=$previous published_at=$latest_at published_id=$latest_id
manifest="$work/manifest.json"
printf '[]\n' > "$manifest"
batch_bytes=0

publish_unavailable() {
  local state marker
  # This review stays pending, preserving any findings and checkpoint already
  # published. A later retry updates the same comment instead of duplicating it.
  state=$(jq -cn --arg id "$review_id" --arg head "$head_sha" --arg base "$base_sha" --arg latest_at "$published_at" --arg latest_id "$published_id" --argjson revision "$revision" --argjson files "$published_files" --argjson reports "$reports" --argjson pending_files "$pending_files" '{version:1,revision:$revision,review_id:$id,head:$head,base:$base,latest_at:$latest_at,latest_id:$latest_id,files:$files,pending:true,reports:$reports,pending_files:$pending_files}')
  marker=$(printf %s "$state" | base64 | tr -d '\n')
  {
    printf '## OpenCode review\n\n**Review pending:** the exact submitted commit is unavailable or could not be fetched. No newer HEAD was substituted; no new files were checkpointed. The review will retry.\n\n'
    jq -r '.[] | ., ""' <<<"$reports"
    printf '<!-- aidd-review-v1:%s -->\n' "$marker"
  } > "$work/comment.md"
  if (( $(wc -c < "$work/comment.md") > 60000 )); then
    # Keep the prior partial comment visible if repeating its reports would
    # exceed the limit; the new marker still retains them for the next retry.
    {
      printf '## OpenCode review\n\n**Review pending:** the exact submitted commit is unavailable or could not be fetched. No newer HEAD was substituted; no new files were checkpointed. Earlier findings remain in the previous comment.\n\n'
      printf '<!-- aidd-review-v1:%s -->\n' "$marker"
    } > "$work/comment.md"
    comment_id=''
  fi
  (( $(wc -c < "$work/comment.md") <= 60000 )) || { echo 'Prior checkpoint exceeds the comment limit' >&2; return 1; }
  jq -n --rawfile body "$work/comment.md" '{body:$body}' > "$work/comment.json"
  if [[ -n $comment_id ]]; then
    gh api -X PATCH "$root/issues/comments/$comment_id" --input "$work/comment.json" >/dev/null
  else
    gh api -X POST "$root/issues/$pr/comments" --input "$work/comment.json" >/dev/null
  fi
  echo 'Submitted review commit unavailable; review remains pending' >&2
  exit 1
}

if [[ ! $head_sha =~ ^[0-9a-f]{40}$ || ! $base_sha =~ ^[0-9a-f]{40}$ ]]; then publish_unavailable; fi
clone_url=$(gh api "$root" --jq .clone_url)
# GitHub credentials stay on the host and are never written into git configuration.
export GIT_TERMINAL_PROMPT=0 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_NO_REPLACE_OBJECTS=1
git -C "$work/repo" init -q
if ! git -C "$work/repo" -c credential.helper='!gh auth git-credential' fetch -q --no-tags "$clone_url" "$base_sha" "$head_sha"; then publish_unavailable; fi
if ! merge_base=$(git -C "$work/repo" merge-base "$base_sha" "$head_sha"); then publish_unavailable; fi
# A checkout includes files that a PR-controlled export-ignore attribute could
# hide from git archive. Never materialize symlinks to the runner filesystem.
if ! git -C "$work/repo" --work-tree="$work/input/source" \
  -c core.symlinks=false -c core.hooksPath=/dev/null -c core.attributesFile=/dev/null \
  checkout --force "$head_sha" -- .; then publish_unavailable; fi

add_note() {
  notes=$(jq -cn --argjson notes "$notes" --arg path "$1" --arg reason "$2" '$notes + [{path:$path, reason:$reason}]')
}

publish_fallback() {
  local fallback_state fallback_marker
  # Keep the last published checkpoint. Never overwrite a partial comment:
  # earlier findings must remain visible when this output is too large.
  fallback_state=$(jq -cn --arg id "$review_id" --arg head "$head_sha" --arg base "$base_sha" --arg latest_at "$published_at" --arg latest_id "$published_id" --argjson revision "$revision" --argjson files "$published_files" '{version:1,revision:$revision,review_id:$id,head:$head,base:$base,latest_at:$latest_at,latest_id:$latest_id,files:$files,pending:false}')
  fallback_marker=$(printf %s "$fallback_state" | base64 | tr -d '\n')
  {
    printf '## OpenCode review\n\nThe review output exceeded the comment limit and could not be published. No newly reviewed files were checkpointed; previous findings remain in earlier comments. Submit a new review to retry.\n'
    printf '\n<!-- aidd-review-v1:%s -->\n' "$fallback_marker"
  } > "$work/comment.md"
  (( $(wc -c < "$work/comment.md") <= 60000 )) || { echo 'Prior checkpoint exceeds the comment limit' >&2; return 1; }
  jq -n --rawfile body "$work/comment.md" '{body:$body}' > "$work/comment.json"
  gh api -X POST "$root/issues/$pr/comments" --input "$work/comment.json" >/dev/null
  discard "$review_drafts"
  exit 0
}

publish_checkpoint() {
  local pending=$1 state_files state_at state_id state marker response
  if [[ -z $published_at || $submitted_at > $published_at || ( $submitted_at == "$published_at" && $review_id -ge $published_id ) ]]; then
    if [[ $pending == true ]]; then
      state_files=$(jq -cn --argjson previous "$published_files" --argjson current "$next" '$previous + $current')
    else
      state_files=$next
    fi
    state_at=$submitted_at state_id=$review_id
  else
    state_files=$published_files state_at=$published_at state_id=$published_id
  fi
  state=$(jq -cn --arg id "$review_id" --arg head "$head_sha" --arg base "$base_sha" --arg latest_at "$state_at" --arg latest_id "$state_id" --argjson revision "$revision" --argjson files "$state_files" --argjson pending "$pending" --argjson reports "$reports" --argjson pending_files "$next" '{version:1,revision:$revision,review_id:$id,head:$head,base:$base,latest_at:$latest_at,latest_id:$latest_id,files:$files,pending:$pending} + (if $pending then {reports:$reports,pending_files:$pending_files} else {} end)')
  marker=$(printf %s "$state" | base64 | tr -d '\n')
  {
    printf "## OpenCode review\n\nReviewed commit: \`%s\`.\n\n" "$head_sha"
    if [[ $context_truncated == true ]]; then printf '**Limitation:** PR context was truncated to fit review limits.\n\n'; fi
    if [[ $pending == true ]]; then printf '**Review in progress:** some files are not yet confirmed.\n\n'; fi
    if [[ $(jq 'length' <<<"$reports") == 0 && $(jq 'length' <<<"$notes") == 0 ]]; then
      if [[ $pending == false ]]; then printf 'No changed files require another review.\n'; fi
    else
      jq -r '.[] | ., ""' <<<"$reports"
      if [[ $(jq 'length' <<<"$notes") != 0 ]]; then
        printf '### Files not reviewed\n\n'
        jq -r '.[] | "- " + (.path | @json) + ": " + .reason' <<<"$notes"
      fi
    fi
    printf '\n<!-- aidd-review-v1:%s -->\n' "$marker"
  } > "$work/comment.md"
  if (( $(wc -c < "$work/comment.md") > 60000 )); then publish_fallback; fi
  jq -n --rawfile body "$work/comment.md" '{body:$body}' > "$work/comment.json"
  if [[ -n $comment_id ]]; then
    gh api -X PATCH "$root/issues/comments/$comment_id" --input "$work/comment.json" >/dev/null
  else
    response=$(gh api -X POST "$root/issues/$pr/comments" --input "$work/comment.json")
    comment_id=$(jq -er '.id | select(type == "number" and . > 0 and floor == .)' <<<"$response") || { echo 'Comment was published without a valid ID' >&2; return 1; }
  fi
  published_files=$state_files published_at=$state_at published_id=$state_id
  revision=$((revision + 1))
}

run_batch() {
  local output="$work/model-output.json" item path digest result reviewed_count=0 draft_key draft_file from_draft=0 runner_failed=0
  [[ $(jq 'length' "$manifest") != 0 ]] || return 0
  draft_key=$({ printf '%s\n' "$head_sha"; sha256sum "$work/context.json" | awk '{print $1}'; jq -cS '[.[] | {path,fingerprint}] | sort_by(.path)' "$manifest"; } | sha256sum | awk '{print $1}')
  draft_file="$review_drafts/$draft_key.json"
  : > "$output"
  if [[ -f $draft_file && ! -L $draft_file ]]; then
    cp "$draft_file" "$output"
    from_draft=1
  elif ! env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" LANG="${LANG:-C.UTF-8}" \
      "$REVIEW_MODEL_RUNNER" "$work/input" "$manifest" "$output"; then
    runner_failed=1
  fi
  if [[ $runner_failed == 1 ]]; then
    while IFS= read -r item; do
      path=$(jq -rj '.path, "\u0001"' <<<"$item"); path=${path%$'\001'}
      add_note "$path" 'Reviewer failed; not reviewed.'
    done < <(jq -c '.[]' "$manifest")
    failed=1
  elif ! jq -e --slurpfile targets "$manifest" '
      (.report | type == "string" and length > 0) and
      (.reviewed | type == "array" and all(.[]; type == "string")) and
      ((.reviewed | unique | length) == (.reviewed | length)) and
      all(.reviewed[]; . as $name | any($targets[0][]; .path == $name))
    ' "$output" >/dev/null; then
    if [[ $from_draft == 1 ]]; then discard "$draft_file"; fi
    while IFS= read -r item; do
      path=$(jq -rj '.path, "\u0001"' <<<"$item"); path=${path%$'\001'}
      add_note "$path" 'Reviewer returned invalid coverage; not reviewed.'
    done < <(jq -c '.[]' "$manifest")
    failed=1
  else
    result=$(jq -r .report "$output")
    if [[ $from_draft == 0 ]] && jq -e '.reviewed | length > 0' "$output" >/dev/null; then save_draft "$output" "$draft_file"; fi
    if (( $(printf %s "$result" | wc -c) + $(printf %s "$reports" | wc -c) > 50000 )); then publish_fallback; fi
    while IFS= read -r item; do
      path=$(jq -rj '.path, "\u0001"' <<<"$item"); path=${path%$'\001'}
      digest=$(jq -r '.fingerprint' <<<"$item")
      if jq -e --arg path "$path" '.reviewed | index($path) != null' "$output" >/dev/null; then
        next=$(jq -cn --argjson state "$next" --arg path "$path" --arg hash "$digest" '$state + {($path):$hash}')
        reviewed_count=$((reviewed_count + 1))
      else
        add_note "$path" 'Reviewer did not confirm a complete review.'
        failed=1
      fi
    done < <(jq -c '.[]' "$manifest")
    if (( reviewed_count > 0 )); then
      reports=$(jq -cn --argjson reports "$reports" --arg report "$result" '$reports + [$report]')
      publish_checkpoint true
      discard "$draft_file"
    fi
  fi
  printf '[]\n' > "$manifest"
  batch_bytes=0
}

index=0
git -C "$work/repo" --literal-pathspecs diff --name-status -z -M "$merge_base" "$head_sha" > "$work/paths"
while IFS= read -r -d '' status && IFS= read -r -d '' name; do
  previous_name=''
  if [[ $status == R* || $status == C* ]]; then
    previous_name=$name
    IFS= read -r -d '' name || { echo 'Invalid renamed path' >&2; exit 1; }
  fi
  index=$((index + 1))
  # Preserve unusual but valid UTF-8 paths. Invalid paths are explicitly skipped.
  if ! printf %s "$name" | iconv -f UTF-8 -t UTF-8 >/dev/null 2>&1; then
    add_note "$(printf '%q' "$name")" 'Path is not valid UTF-8.'
    continue
  fi
  paths=("$name")
  [[ -z $previous_name ]] || paths+=("$previous_name")
  patch="$work/patch-$index"
  stats="$work/stats-$index"
  git -C "$work/repo" --literal-pathspecs diff --no-ext-diff --no-textconv --full-index -M "$merge_base" "$head_sha" -- "${paths[@]}" > "$patch"
  git -C "$work/repo" --literal-pathspecs diff --numstat -z -M "$merge_base" "$head_sha" -- "${paths[@]}" > "$stats"
  [[ -s $patch ]] || { add_note "$name" 'Diff could not be produced.'; continue; }
  fingerprint=$(sha256sum "$patch" | awk '{print $1}')
  if jq -e --arg path "$name" --arg hash "$fingerprint" '.[$path] == $hash' <<<"$previous" >/dev/null ||
     jq -e --arg path "$name" --arg hash "$fingerprint" '.[$path] == $hash' <<<"$pending_files" >/dev/null; then
    next=$(jq -cn --argjson state "$next" --arg path "$name" --arg hash "$fingerprint" '$state + {($path):$hash}')
    continue
  fi
  bytes=$(wc -c < "$patch" | tr -d ' ')
  if [[ $(head -c 2 "$stats") == $'-\t' ]] || ! iconv -f UTF-8 -t UTF-8 "$patch" >/dev/null 2>&1; then
    add_note "$name" 'Binary or non-UTF-8 diff cannot be reviewed.'
    continue
  fi
  if (( bytes > 120000 )) || LC_ALL=C awk 'length($0) > 1800 {exit 1}' "$patch"; then
    :
  else
    add_note "$name" 'Diff contains a line too long for a complete read.'
    continue
  fi
  if (( bytes > 120000 )); then
    add_note "$name" 'Diff is too large for one reliable review session.'
    continue
  fi
  if grep -qE '^[+-]Subproject commit [0-9a-f]+' "$patch"; then
    add_note "$name" 'Submodule contents are unavailable.'
    continue
  fi
  if (( batch_bytes + bytes > 120000 )); then run_batch; fi
  # Each complete input stays below OpenCode's 50 KiB / 2,000-line read limits.
  prefix="$work/input/review-input/file-$(printf '%05d' "$index")"
  token=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
  LC_ALL=C awk -v prefix="$prefix" -v token="$token" '
    function open_chunk() { i++; file=sprintf("%s-%03d.txt",prefix,i); print "AIDD_BEGIN_" token "_" i > file; count=0; size=0 }
    function close_chunk() { print "AIDD_END_" token "_" i >> file; close(file) }
    { n=length($0)+1; if (!file) open_chunk(); if (count >= 500 || size+n > 30000) {close_chunk(); open_chunk()} print >> file; count++; size+=n }
    END {if (file) close_chunk()}
  ' "$patch"
  chunks='[]'
  for chunk in "$prefix"-*.txt; do
    chunk_name=${chunk##*/}
    chunks=$(jq -cn --argjson chunks "$chunks" --arg path "review-input/$chunk_name" --arg begin "$(head -n 1 "$chunk")" --arg end_marker "$(tail -n 1 "$chunk")" '$chunks + [{path:$path,begin:$begin,end:$end_marker}]')
  done
  jq -c --arg path "$name" --arg status "$status" --arg fingerprint "$fingerprint" --argjson chunks "$chunks" '. + [{path:$path,status:$status,fingerprint:$fingerprint,chunks:$chunks}]' "$manifest" > "$work/manifest-next"
  mv "$work/manifest-next" "$manifest"
  batch_bytes=$((batch_bytes + bytes))
done < "$work/paths"
run_batch

if [[ $failed == 1 ]]; then publish_checkpoint true; else publish_checkpoint false; discard "$review_drafts"; fi
[[ $failed == 0 ]] || exit 1
