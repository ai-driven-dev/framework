#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd -P)
mkdir -p "$root/.tmp"
work=$(mktemp -d "$root/.tmp/pr-review-test.XXXXXXXX")
cleanup() { if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi; }
trap cleanup EXIT
mkdir -p "$work/bin" "$work/state" "$work/repo"
export PATH="$work/bin:$PATH" GH_REPO=test/repo GH_TOKEN=dummy REVIEW_BOT_LOGIN='aidd[bot]' FAKE_STATE="$work/state" FAKE_REPO="$work/repo"
export XDG_STATE_HOME="$work/state/xdg"
export REVIEW_MODEL_RUNNER="$work/bin/model"

cat > "$work/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
[[ $1 == api ]] || exit 2
shift
[[ ${1:-} != --paginate ]] || shift
method=GET
if [[ ${1:-} == -X ]]; then method=$2; shift 2; fi
endpoint=$1; shift
case "$endpoint" in
  repos/test/repo)
    [[ ${1:-} == --jq && ${2:-} == .clone_url ]]
    printf '%s\n' "$FAKE_REPO" ;;
  repos/test/repo/pulls/8)
    jq -n --arg base "$FAKE_BASE" --arg head_repo "${FAKE_HEAD_REPO:-test/repo}" --arg title "${FAKE_TITLE:-Example PR}" --arg body "${FAKE_BODY:-Acceptance criterion: preserve empty input.}" '{state:"open",title:$title,body:$body,base:{sha:$base,repo:{full_name:"test/repo"}},head:{repo:{full_name:$head_repo}}}' ;;
  repos/test/repo/pulls/8/reviews/*)
    id=${endpoint##*/}
    printf -v submitted_at '2026-01-01T00:00:%02dZ' "$((id-100))"
    jq -n --argjson id "$id" --arg commit "$FAKE_HEAD" --arg time "${FAKE_SUBMITTED_AT:-$submitted_at}" --arg state "${FAKE_REVIEW_STATE:-COMMENTED}" --arg missing "${FAKE_MISSING_HEAD:-0}" '{id:$id,user:{id:8973343},state:$state,commit_id:(if $missing == "1" then null else $commit end),submitted_at:$time}' ;;
  'repos/test/repo/issues/8/comments?per_page=100')
    cat "$FAKE_STATE/comments.json" ;;
  repos/test/repo/issues/8/comments)
    [[ $method == POST && $1 == --input ]]
    [[ ! -e $FAKE_STATE/fail-post ]] || exit 1
    body=$(jq -r .body "$2")
    jq --arg body "$body" '. + [{id:(length+1),user:{login:"aidd[bot]",type:"Bot"},body:$body}]' "$FAKE_STATE/comments.json" > "$FAKE_STATE/next"
    mv "$FAKE_STATE/next" "$FAKE_STATE/comments.json"
    [[ ! -e $FAKE_STATE/fail-post-after ]] || exit 1
    jq '.[-1] | {id}' "$FAKE_STATE/comments.json" ;;
  repos/test/repo/issues/comments/*)
    [[ $method == PATCH && $1 == --input ]]
    [[ ! -e $FAKE_STATE/fail-patch ]] || exit 1
    id=${endpoint##*/}
    body=$(jq -r .body "$2")
    jq --argjson id "$id" --arg body "$body" 'map(if .id == $id then .body=$body else . end)' "$FAKE_STATE/comments.json" > "$FAKE_STATE/next"
    mv "$FAKE_STATE/next" "$FAKE_STATE/comments.json"
    printf '{}\n' ;;
  *) printf 'Unexpected gh call: %s\n' "$endpoint" >&2; exit 2 ;;
esac
GH
cat > "$work/bin/model" <<'MODEL'
#!/usr/bin/env bash
set -euo pipefail
[[ -z ${GH_TOKEN:-} && -z ${GITHUB_TOKEN:-} ]] || { echo 'GitHub token leaked' >&2; exit 1; }
[[ -z ${GH_ENTERPRISE_TOKEN:-} && -z ${UNRELATED_SECRET:-} ]] || { echo 'Unexpected secret leaked' >&2; exit 1; }
[[ -f $1/source/b.txt ]] || { echo 'Source checkout omitted an export-ignored file' >&2; exit 1; }
state="$(dirname "$0")/../state"
cp "$1/review-input/pr-context.txt" "$state/context-seen"
printf '%s\n' "$(jq -c '[.[].path]' "$2")" >> "$state/model-calls"
[[ ! -e $state/fail ]] || exit 1
if [[ -e $state/fail-batch-b ]] && jq -e 'any(.[]; .path == "b-large.txt")' "$2" >/dev/null; then exit 1; fi
if [[ -e $state/interrupt-batch-b ]] && jq -e 'any(.[]; .path == "b-large.txt")' "$2" >/dev/null; then kill -TERM "$PPID"; exit 1; fi
if [[ -e $state/large-report-b ]] && jq -e 'any(.[]; .path == "b-large.txt")' "$2" >/dev/null; then
  jq -n --slurpfile targets "$2" '{report:("x" * 65000),reviewed:[$targets[0][].path]}' > "$3"
  exit 0
fi
jq -n --slurpfile targets "$2" '{report:("Found a concrete problem. Files: " + ([$targets[0][].path] | join(", "))),reviewed:[$targets[0][].path]}' > "$3"
MODEL
chmod +x "$work/bin/gh" "$work/bin/model"
printf '[]\n' > "$FAKE_STATE/comments.json"

cd "$FAKE_REPO"
git init -q -b main
git config user.name 'Review test'
git config user.email 'review-test@example.invalid'
printf 'before\n' > a.txt
printf 'before\n' > b.txt
printf 'b.txt export-ignore\n' > .gitattributes
git add .
git commit -qm base
FAKE_BASE=$(git rev-parse HEAD)
export FAKE_BASE
printf 'changed a\n' > a.txt
printf 'changed b\n' > b.txt
git add .
git commit -qm first
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
first_head=$FAKE_HEAD
review="$root/scripts/pr-review/review.sh"

GH_ENTERPRISE_TOKEN=secret UNRELATED_SECRET=secret FAKE_HEAD_REPO=fork/repo "$review" 8 101
[[ $(jq length "$FAKE_STATE/comments.json") == 1 ]]
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 1 ]]
jq -e 'contains(["a.txt", "b.txt"])' "$FAKE_STATE/model-calls" >/dev/null
grep -Fxq 'Title: Example PR' "$FAKE_STATE/context-seen"
grep -Fxq 'Acceptance criterion: preserve empty input.' "$FAKE_STATE/context-seen"

# Re-delivery is idempotent; a new review with unchanged files skips the model.
"$review" 8 101
"$review" 8 102
[[ $(jq length "$FAKE_STATE/comments.json") == 2 ]]
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 1 ]]

# Only changed files are re-reviewed on the next submission.
printf 'changed again\n' > a.txt
git add a.txt
git commit -qm second
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
"$review" 8 103
[[ $(tail -n 1 "$FAKE_STATE/model-calls") == '["a.txt"]' ]]

# A model failure publishes an explicit partial result and allows the same
# submission to be retried by updating, rather than duplicating, the comment.
printf 'changed third time\n' > a.txt
git add a.txt
git commit -qm third
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
touch "$FAKE_STATE/fail"
if "$review" 8 104; then echo 'Expected failure' >&2; exit 1; fi
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/fail"; else rm -- "$FAKE_STATE/fail"; fi
[[ $(jq length "$FAKE_STATE/comments.json") == 4 ]]
jq -e '.[-1].body | contains("Reviewer failed; not reviewed")' "$FAKE_STATE/comments.json" >/dev/null
"$review" 8 104
[[ $(jq length "$FAKE_STATE/comments.json") == 4 ]]
jq -e '.[-1].body | contains("Found a concrete problem")' "$FAKE_STATE/comments.json" >/dev/null
calls=$(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ')
"$review" 8 105
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == "$calls" ]]

# Oversized individual changes are named, never checkpointed as reviewed.
awk 'BEGIN { for(i=0;i<7000;i++) print "abcdefghijklmnopqrst" }' > huge.txt
git add huge.txt
git commit -qm huge
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
"$review" 8 106
jq -e '.[-1].body | contains("huge.txt") and contains("too large")' "$FAKE_STATE/comments.json" >/dev/null

# A late, older submission cannot replace the newest checkpoint.
current_head=$FAKE_HEAD
FAKE_HEAD=$first_head FAKE_SUBMITTED_AT=2026-01-01T00:00:01Z "$review" 8 107
calls=$(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ')
FAKE_HEAD=$current_head "$review" 8 108
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == "$calls" ]]

# A human cannot spoof a bot checkpoint by pasting its marker.
forged=$(jq -cn '{version:1,review_id:"109",files:{},pending:false}' | base64 | tr -d '\n')
jq -n --arg forged "$forged" '[{id:1,user:{login:"human",type:"User"},body:("<!-- aidd-review-v1:" + $forged + " -->")}]' > "$FAKE_STATE/comments.json"
calls=$(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ')
FAKE_SUBMITTED_AT=2026-01-01T00:00:09Z "$review" 8 109
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') -gt "$calls" ]]
[[ $(jq length "$FAKE_STATE/comments.json") == 2 ]]

# Retrying an older comment after a newer comment must publish the latest state.
printf '[]\n' > "$FAKE_STATE/comments.json"
touch "$FAKE_STATE/fail"
if FAKE_SUBMITTED_AT=2026-01-01T00:00:20Z "$review" 8 120; then echo 'Expected failure' >&2; exit 1; fi
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/fail"; else rm -- "$FAKE_STATE/fail"; fi
FAKE_SUBMITTED_AT=2026-01-01T00:00:19Z "$review" 8 119
FAKE_SUBMITTED_AT=2026-01-01T00:00:20Z "$review" 8 120
calls=$(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ')
GH_ENTERPRISE_TOKEN=secret UNRELATED_SECRET=secret FAKE_REVIEW_STATE=DISMISSED FAKE_SUBMITTED_AT=2026-01-01T00:00:21Z "$review" 8 121
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == "$calls" ]]

# Oversized descriptions are bounded and announced both to the reviewer and
# in the public result; the title and beginning of the criteria are retained.
printf 'changed after context check\n' > a.txt
git add a.txt
git commit -qm context
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
long_body=$(awk 'BEGIN {printf "Acceptance criterion: "; for (i=0;i<11000;i++) printf "x"}')
FAKE_BODY="$long_body" FAKE_SUBMITTED_AT=2026-01-01T00:00:22Z "$review" 8 122
grep -Fq 'PR context truncated to fit review limits' "$FAKE_STATE/context-seen"
[[ $(wc -c < "$FAKE_STATE/context-seen") -lt 48000 ]]
jq -Rne 'all(inputs; length <= 400)' "$FAKE_STATE/context-seen" >/dev/null
LC_ALL=C awk 'NR > 1000 || length($0) > 1800 {exit 1}' "$FAKE_STATE/context-seen"
jq -e '.[-1].body | contains("PR context was truncated")' "$FAKE_STATE/comments.json" >/dev/null

# A description with many short lines also needs an explicit truncation notice.
printf 'changed for multiline context\n' > a.txt
git add a.txt
git commit -qm multiline
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
long_body=$(awk 'BEGIN {for (i=0;i<1200;i++) print "criterion"}')
FAKE_BODY="$long_body" FAKE_SUBMITTED_AT=2026-01-01T00:00:23Z "$review" 8 123
grep -Fq 'PR context truncated to fit review limits' "$FAKE_STATE/context-seen"
[[ $(wc -l < "$FAKE_STATE/context-seen") -le 1000 ]]
jq -e '.[-1].body | contains("PR context was truncated")' "$FAKE_STATE/comments.json" >/dev/null

# A successful first lot must stay visible after a failed second lot is retried.
mkdir -p "$work/two-lots"
export FAKE_REPO="$work/two-lots"
cd "$FAKE_REPO"
git init -q -b main
git config user.name 'Review test'
git config user.email 'review-test@example.invalid'
printf 'context\n' > b.txt
git add b.txt
git commit -qm base
FAKE_BASE=$(git rev-parse HEAD)
export FAKE_BASE
awk 'BEGIN {for(i=0;i<3200;i++) print "abcdefghijklmnopqrst"}' > a-large.txt
awk 'BEGIN {for(i=0;i<3200;i++) print "abcdefghijklmnopqrst"}' > b-large.txt
git add a-large.txt b-large.txt
git commit -qm 'two large changes'
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
printf '[]\n' > "$FAKE_STATE/comments.json"
: > "$FAKE_STATE/model-calls"
touch "$FAKE_STATE/fail-batch-b"
if FAKE_SUBMITTED_AT=2026-01-01T00:00:24Z "$review" 8 124; then echo 'Expected second lot failure' >&2; exit 1; fi
jq -e '.[0].body | contains("Files: a-large.txt") and contains("Reviewer failed; not reviewed")' "$FAKE_STATE/comments.json" >/dev/null
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/fail-batch-b"; else rm -- "$FAKE_STATE/fail-batch-b"; fi
FAKE_SUBMITTED_AT=2026-01-01T00:00:24Z "$review" 8 124
[[ $(jq length "$FAKE_STATE/comments.json") == 1 ]]
jq -e '.[0].body | contains("Files: a-large.txt") and contains("Files: b-large.txt")' "$FAKE_STATE/comments.json" >/dev/null
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 3 ]]
[[ $(tail -n 1 "$FAKE_STATE/model-calls") == '["b-large.txt"]' ]]
jq -e '.[0].body | capture("<!-- aidd-review-v1:(?<data>[A-Za-z0-9+/=]+) -->\\s*$").data | @base64d | fromjson | .pending == false and (has("reports") | not) and (has("pending_files") | not)' "$FAKE_STATE/comments.json" >/dev/null

# An interrupted job keeps its first published batch and resumes only the second.
printf '[]\n' > "$FAKE_STATE/comments.json"
: > "$FAKE_STATE/model-calls"
touch "$FAKE_STATE/interrupt-batch-b"
if FAKE_SUBMITTED_AT=2026-01-01T00:00:25Z "$review" 8 125; then echo 'Expected interrupted review' >&2; exit 1; fi
jq -e '.[0].body | contains("Files: a-large.txt") and contains("Review in progress")' "$FAKE_STATE/comments.json" >/dev/null
# Missing commit updates the same pending comment without erasing the first lot.
if FAKE_MISSING_HEAD=1 FAKE_SUBMITTED_AT=2026-01-01T00:00:25Z "$review" 8 125; then echo 'Expected unavailable commit' >&2; exit 1; fi
[[ $(jq length "$FAKE_STATE/comments.json") == 1 ]]
jq -e '.[0].body | contains("Files: a-large.txt") and contains("exact submitted commit is unavailable")' "$FAKE_STATE/comments.json" >/dev/null
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/interrupt-batch-b"; else rm -- "$FAKE_STATE/interrupt-batch-b"; fi
FAKE_SUBMITTED_AT=2026-01-01T00:00:25Z "$review" 8 125
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 3 ]]
[[ $(tail -n 1 "$FAKE_STATE/model-calls") == '["b-large.txt"]' ]]
jq -e '.[0].body | contains("Files: a-large.txt") and contains("Files: b-large.txt")' "$FAKE_STATE/comments.json" >/dev/null

# A report exceeding the comment limit does not overwrite a partial review or
# checkpoint its new findings, and replaying the same submission is free.
printf '[]\n' > "$FAKE_STATE/comments.json"
: > "$FAKE_STATE/model-calls"
touch "$FAKE_STATE/large-report-b"
FAKE_SUBMITTED_AT=2026-01-01T00:00:26Z "$review" 8 126
[[ $(jq length "$FAKE_STATE/comments.json") == 2 ]]
jq -e '.[0].body | contains("Files: a-large.txt") and contains("Review in progress")' "$FAKE_STATE/comments.json" >/dev/null
jq -e '.[1].body | contains("No newly reviewed files were checkpointed")' "$FAKE_STATE/comments.json" >/dev/null
jq -e '.[1].body | capture("<!-- aidd-review-v1:(?<data>[A-Za-z0-9+/=]+) -->\\s*$").data | @base64d | fromjson | .pending == false and (.files | has("a-large.txt")) and (.files | has("b-large.txt") | not)' "$FAKE_STATE/comments.json" >/dev/null
FAKE_SUBMITTED_AT=2026-01-01T00:00:26Z "$review" 8 126
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 2 ]]
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/large-report-b"; else rm -- "$FAKE_STATE/large-report-b"; fi
FAKE_SUBMITTED_AT=2026-01-01T00:00:27Z "$review" 8 127
[[ $(tail -n 1 "$FAKE_STATE/model-calls") == '["b-large.txt"]' ]]

# Missing or unfetchable review commits stay pending on the same comment and
# never run the model or silently substitute the current PR head.
calls=$(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ')
if FAKE_MISSING_HEAD=1 FAKE_SUBMITTED_AT=2026-01-01T00:00:28Z "$review" 8 128; then echo 'Expected missing commit' >&2; exit 1; fi
comments=$(jq length "$FAKE_STATE/comments.json")
if FAKE_MISSING_HEAD=1 FAKE_SUBMITTED_AT=2026-01-01T00:00:28Z "$review" 8 128; then echo 'Expected missing commit on retry' >&2; exit 1; fi
[[ $(jq length "$FAKE_STATE/comments.json") == "$comments" ]]
jq -e '.[-1].body | contains("exact submitted commit is unavailable")' "$FAKE_STATE/comments.json" >/dev/null
if FAKE_HEAD=0000000000000000000000000000000000000001 FAKE_SUBMITTED_AT=2026-01-01T00:00:29Z "$review" 8 129; then echo 'Expected unfetchable commit' >&2; exit 1; fi
jq -e '.[-1].body | contains("exact submitted commit is unavailable")' "$FAKE_STATE/comments.json" >/dev/null
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == "$calls" ]]

# A failed POST leaves a private draft; a retry reuses it despite fresh chunk
# markers and removes it once the checkpoint is published.
printf '[]\n' > "$FAKE_STATE/comments.json"
: > "$FAKE_STATE/model-calls"
touch "$FAKE_STATE/fail-post"
if FAKE_SUBMITTED_AT=2026-01-01T00:00:30Z "$review" 8 130; then echo 'Expected POST failure' >&2; exit 1; fi
[[ $(jq length "$FAKE_STATE/comments.json") == 0 ]]
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 1 ]]
[[ $(find "$XDG_STATE_HOME/aidd-pr-review" -type f -name '*.json' | wc -l | tr -d ' ') == 1 ]]
[[ -z $(find "$XDG_STATE_HOME/aidd-pr-review" -perm -077 -print) ]]
if grep -R -Eq 'dummy|UNRELATED_SECRET' "$XDG_STATE_HOME/aidd-pr-review"; then echo 'Secret leaked to draft' >&2; exit 1; fi
# A target-branch commit that does not change the merge-base or the diff must
# not invalidate the draft.
git switch -qc target-advanced "$FAKE_BASE"
printf 'unrelated target-only change\n' > target-only.txt
git add target-only.txt
git commit -qm 'advance target branch'
FAKE_BASE=$(git rev-parse HEAD)
export FAKE_BASE
git switch -q main
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/fail-post"; else rm -- "$FAKE_STATE/fail-post"; fi
FAKE_SUBMITTED_AT=2026-01-01T00:00:30Z "$review" 8 130
[[ $(grep -Fc '["a-large.txt"]' "$FAKE_STATE/model-calls") == 1 ]]
[[ -z $(find "$XDG_STATE_HOME/aidd-pr-review" -type f -name '*.json' -print) ]]

# The same guarantee applies to PATCH of an existing pending comment.
printf 'another change\n' >> a-large.txt
git add a-large.txt
git commit -qm 'change after retry'
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
if FAKE_MISSING_HEAD=1 FAKE_SUBMITTED_AT=2026-01-01T00:00:31Z "$review" 8 131; then echo 'Expected pending comment' >&2; exit 1; fi
: > "$FAKE_STATE/model-calls"
touch "$FAKE_STATE/fail-patch"
if FAKE_SUBMITTED_AT=2026-01-01T00:00:31Z "$review" 8 131; then echo 'Expected PATCH failure' >&2; exit 1; fi
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 1 ]]
[[ $(find "$XDG_STATE_HOME/aidd-pr-review" -type f -name '*.json' | wc -l | tr -d ' ') == 1 ]]
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/fail-patch"; else rm -- "$FAKE_STATE/fail-patch"; fi
FAKE_SUBMITTED_AT=2026-01-01T00:00:31Z "$review" 8 131
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 1 ]]
[[ -z $(find "$XDG_STATE_HOME/aidd-pr-review" -type f -name '*.json' -print) ]]

# If GitHub accepted a POST but its reply was lost, the published pending
# marker prevents another model call and finalization removes the stale draft.
printf 'one more change\n' >> a-large.txt
git add a-large.txt
git commit -qm 'change after lost response'
FAKE_HEAD=$(git rev-parse HEAD)
export FAKE_HEAD
: > "$FAKE_STATE/model-calls"
touch "$FAKE_STATE/fail-post-after"
if FAKE_SUBMITTED_AT=2026-01-01T00:00:32Z "$review" 8 132; then echo 'Expected lost response' >&2; exit 1; fi
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 1 ]]
if [[ $(uname -s) == Darwin ]]; then trash "$FAKE_STATE/fail-post-after"; else rm -- "$FAKE_STATE/fail-post-after"; fi
FAKE_SUBMITTED_AT=2026-01-01T00:00:32Z "$review" 8 132
[[ $(wc -l < "$FAKE_STATE/model-calls" | tr -d ' ') == 1 ]]
[[ -z $(find "$XDG_STATE_HOME/aidd-pr-review" -type f -name '*.json' -print) ]]
printf 'review orchestration scenarios passed\n'

# The scheduled workflow discovers every Alex submission, trusts only bot
# checkpoints, and continues after individual failures. Exercise the actual
# workflow script with paginated GitHub responses and a fake review runner.
mkdir -p "$work/discovery/bin" "$work/discovery/project/scripts/pr-review" "$work/discovery/run"
awk '
  /^      - name: Review new submissions$/ {found=1; next}
  found && /^        run: \|$/ {reading=1; next}
  reading && /^          / {sub(/^          /, ""); print; next}
  reading && /^$/ {print; next}
  reading {exit}
' "$root/.github/workflows/opencode-review.yml" > "$work/discovery/project/discover.sh"
[[ -s $work/discovery/project/discover.sh ]]
export DISCOVERY_ROOT="$work/discovery"
cat > "$DISCOVERY_ROOT/bin/gh" <<'GH_DISCOVERY'
#!/usr/bin/env bash
set -euo pipefail
endpoint=${!#}
printf '%s\n' "$endpoint" >> "$DISCOVERY_ROOT/calls"
case "$endpoint" in
  'repos/test/repo/pulls?state=open&per_page=100') file=pulls ;;
  'repos/test/repo/pulls/'*'/reviews?per_page=100')
    pr=${endpoint#*pulls/}; pr=${pr%%/*}
    [[ ${DISCOVERY_FAIL_PR:-} != "$pr" ]] || exit 1
    file="reviews-$pr" ;;
  'repos/test/repo/issues/'*'/comments?per_page=100')
    pr=${endpoint#*issues/}; pr=${pr%%/*}; file="comments-$pr" ;;
  *) exit 2 ;;
esac
cat "$DISCOVERY_ROOT/$file.json"
GH_DISCOVERY
cat > "$DISCOVERY_ROOT/project/scripts/pr-review/review.sh" <<'REVIEW_DISCOVERY'
#!/usr/bin/env bash
printf '%s %s\n' "$1" "$2" >> "$DISCOVERY_ROOT/reviewed"
[[ ${DISCOVERY_FAIL_REVIEW:-} != "$2" ]]
REVIEW_DISCOVERY
chmod +x "$DISCOVERY_ROOT/bin/gh" "$DISCOVERY_ROOT/project/scripts/pr-review/review.sh"
printf '%s\n' '[{"number":8}]' '[{"number":9}]' > "$DISCOVERY_ROOT/pulls.json"
printf '%s\n' '[{"id":101,"user":{"id":8973343},"submitted_at":"2026-01-01T00:00:01Z"},{"id":103,"user":{"id":8973343},"submitted_at":"2026-01-01T00:00:03Z"}]' '[{"id":104,"user":{"id":8973343},"submitted_at":"2026-01-01T00:00:04Z"},{"id":105,"user":{"id":8973343},"submitted_at":"2026-01-01T00:00:05Z"}]' > "$DISCOVERY_ROOT/reviews-8.json"
printf '%s\n' '[{"id":102,"user":{"id":8973343},"submitted_at":"2026-01-01T00:00:02Z"}]' > "$DISCOVERY_ROOT/reviews-9.json"
complete=$(jq -cn '{version:1,review_id:"101",pending:false,revision:1,files:{}}' | base64 | tr -d '\n')
pending=$(jq -cn '{version:1,review_id:"103",pending:true,revision:1,files:{}}' | base64 | tr -d '\n')
forged=$(jq -cn '{version:1,review_id:"104",pending:false,revision:1,files:{}}' | base64 | tr -d '\n')
older=$(jq -cn '{version:1,review_id:"105",pending:false,revision:1,files:{}}' | base64 | tr -d '\n')
newer=$(jq -cn '{version:1,review_id:"105",pending:true,revision:2,files:{}}' | base64 | tr -d '\n')
jq -cn --arg completed_marker "$complete" --arg pending "$pending" --arg forged "$forged" --arg older "$older" --arg newer "$newer" '[{id:1,user:{login:"aidd[bot]",type:"Bot"},body:("<!-- aidd-review-v1:"+$completed_marker+" -->")},{id:2,user:{login:"aidd[bot]",type:"Bot"},body:("<!-- aidd-review-v1:"+$pending+" -->")},{id:3,user:{login:"human",type:"User"},body:("<!-- aidd-review-v1:"+$forged+" -->")},{id:4,user:{login:"aidd[bot]",type:"Bot"},body:("<!-- aidd-review-v1:"+$older+" -->")},{id:5,user:{login:"aidd[bot]",type:"Bot"},body:("<!-- aidd-review-v1:"+$newer+" -->")}]' > "$DISCOVERY_ROOT/comments-8.json"
printf '[]\n' > "$DISCOVERY_ROOT/comments-9.json"
export PATH="$DISCOVERY_ROOT/bin:$PATH" RUNNER_TEMP="$DISCOVERY_ROOT/run" AIDD_REVIEW_ENABLED_AT='2026-01-01T00:00:00Z'
cd "$DISCOVERY_ROOT/project"
: > "$DISCOVERY_ROOT/calls"
: > "$DISCOVERY_ROOT/reviewed"
bash discover.sh
[[ $(cat "$DISCOVERY_ROOT/reviewed") == $'9 102\n8 103\n8 104\n8 105' ]]
[[ $(grep -c 'issues/8/comments' "$DISCOVERY_ROOT/calls") == 1 ]]
[[ $(grep -c 'issues/9/comments' "$DISCOVERY_ROOT/calls") == 1 ]]
: > "$DISCOVERY_ROOT/reviewed"
if DISCOVERY_FAIL_REVIEW=102 bash discover.sh > /dev/null 2>&1; then echo 'Expected review failure' >&2; exit 1; fi
[[ $(cat "$DISCOVERY_ROOT/reviewed") == $'9 102\n8 103\n8 104\n8 105' ]]
: > "$DISCOVERY_ROOT/reviewed"
if DISCOVERY_FAIL_PR=9 bash discover.sh > /dev/null 2>&1; then echo 'Expected discovery failure' >&2; exit 1; fi
[[ $(cat "$DISCOVERY_ROOT/reviewed") == $'8 103\n8 104\n8 105' ]]
: > "$DISCOVERY_ROOT/calls"
if AIDD_REVIEW_ENABLED_AT='2026-02-30T00:00:00Z' bash discover.sh > /dev/null 2>&1; then echo 'Expected invalid date failure' >&2; exit 1; fi
[[ ! -s $DISCOVERY_ROOT/calls ]]
printf 'scheduled discovery scenarios passed\n'
