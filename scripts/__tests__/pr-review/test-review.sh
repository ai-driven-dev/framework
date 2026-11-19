#!/usr/bin/env bash
# Exercise submitted commits, review checkpoints, and credential separation.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../.." && pwd -P)
work=$(mktemp -d "${TMPDIR:-/tmp}/aidd-review-test.XXXXXXXX")
cleanup() { if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi; }
trap cleanup EXIT
mkdir -p "$work/bin" "$work/state" "$work/repo"
export PATH="$work/bin:$PATH" GH_REPO=test/repo GH_TOKEN=write-token GH_REVIEW_TOKEN=read-token
export REVIEW_BOT_LOGIN='aidd[bot]' REVIEW_MODEL_RUNNER="$work/bin/model" FAKE_STATE="$work/state" FAKE_REPO="$work/repo"
export XDG_STATE_HOME="$work/state/xdg"
export OPENCODE_REVIEWER_ID=7654321 RUNNER_TEMP="$work/state" AIDD_REVIEW_ENABLED_AT=2026-01-01T00:00:00Z
export OPENCODE_REVIEW_MODEL='test-provider/test-model#profile'

cat > "$work/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
[[ $1 == api && ${GH_TOKEN:-} == write-token ]] || exit 2
touch "$FAKE_STATE/api-called"
shift
[[ ${1:-} != --paginate ]] || shift
method=GET
if [[ ${1:-} == -X ]]; then method=$2; shift 2; fi
endpoint=$1; shift
[[ ! -e $FAKE_STATE/fail-api ]] || exit 1
case "$endpoint" in
  repos/test/repo)
    [[ ${1:-} == --jq && ${2:-} == .clone_url ]]
    printf '%s\n' "$FAKE_REPO" ;;
  repos/test/repo/pulls/8)
    jq -n --arg base "$FAKE_BASE" '{state:"open",title:"Example PR",body:"Acceptance criterion",base:{sha:$base,repo:{full_name:"test/repo"}}}' ;;
  'repos/test/repo/pulls?state=open&per_page=100')
    printf '[{"number":8}]\n' ;;
  'repos/test/repo/pulls/8/reviews?per_page=100')
    jq -n --argjson author "${FAKE_AUTHOR:-$OPENCODE_REVIEWER_ID}" '[{id:109,user:{id:$author},submitted_at:"2026-01-01T00:00:09Z"}]' ;;
  repos/test/repo/pulls/8/reviews/*)
    id=${endpoint##*/}
    jq -n --argjson id "$id" --arg commit "${FAKE_HEAD_OVERRIDE:-$FAKE_HEAD}" --arg author "${FAKE_AUTHOR:-$OPENCODE_REVIEWER_ID}" \
      '{id:$id,user:{id:($author|tonumber)},state:"COMMENTED",body:("Please handle my review feedback " + ($id|tostring)),commit_id:$commit,submitted_at:("2026-01-01T00:00:" + (($id - 100)|tostring|if length == 1 then "0" + . else . end) + "Z")}' ;;
  'repos/test/repo/issues/8/comments?per_page=100') cat "$FAKE_STATE/comments.json" ;;
  repos/test/repo/issues/8/comments)
    [[ $method == POST && $1 == --input && ! -e $FAKE_STATE/fail-post ]]
    body=$(jq -r .body "$2")
    jq --arg body "$body" '. + [{id:(length+1),user:{login:"aidd[bot]",type:"Bot"},body:$body}]' "$FAKE_STATE/comments.json" > "$FAKE_STATE/next"
    mv "$FAKE_STATE/next" "$FAKE_STATE/comments.json"
    [[ ! -e $FAKE_STATE/fail-post-after ]] || exit 1
    jq '.[-1] | {id}' "$FAKE_STATE/comments.json" ;;
  *) echo "Unexpected gh call: $endpoint" >&2; exit 2 ;;
esac
GH
cat > "$work/bin/model" <<'MODEL'
#!/usr/bin/env bash
set -euo pipefail
state="$(dirname "$0")/../state"
[[ -z ${GH_TOKEN:-} && -z ${GITHUB_TOKEN:-} && -z ${UNRELATED_SECRET:-} && ${GH_REVIEW_TOKEN:-} == read-token ]] || { echo 'Incorrect reviewer credentials' >&2; exit 1; }
[[ ${GH_REPO:-} == test/repo && ${REVIEW_PR:-} == 8 ]]
[[ ${OPENCODE_REVIEW_MODEL:-} == 'test-provider/test-model#profile' ]] || { echo 'Configured review model was not passed to the runner' >&2; exit 1; }
[[ -d $1/source/.git && -f $1/source/link && ! -L $1/source/link ]]
[[ $(git -C "$1/source" rev-parse HEAD) == "$REVIEW_HEAD" ]]
git -C "$1/source" diff --no-ext-diff --no-textconv "$REVIEW_BASE" "$REVIEW_HEAD" -- a.txt > "$state/model-diff"
[[ -s $state/model-diff ]]
[[ ! -e $state/fail-model ]] || exit 1
cp "$1/review-input/pr-context.txt" "$state/context"
cp "$2" "$state/manifest"
printf 'call\n' >> "$state/calls"
if [[ -e $state/invalid ]]; then
  printf '{}\n' > "$3"
elif [[ -e $state/partial ]]; then
  jq -n --slurpfile targets "$2" '{report:"Partial review.",reviewed:[$targets[0][0].path]}' > "$3"
else
  jq -n --slurpfile targets "$2" '{report:"Review complete.",reviewed:[$targets[0][].path]}' > "$3"
fi
MODEL
chmod +x "$work/bin/gh" "$work/bin/model"
printf '[]\n' > "$FAKE_STATE/comments.json"

git -C "$FAKE_REPO" init -q
git -C "$FAKE_REPO" config user.name 'Review test'
git -C "$FAKE_REPO" config user.email 'review-test@example.invalid'
printf 'before\n' > "$FAKE_REPO/a.txt"
printf 'before\n' > "$FAKE_REPO/b.txt"
git -C "$FAKE_REPO" add .
git -C "$FAKE_REPO" commit -qm base
export FAKE_BASE=$(git -C "$FAKE_REPO" rev-parse HEAD)
printf 'after\n' > "$FAKE_REPO/a.txt"
printf 'after\n' > "$FAKE_REPO/b.txt"
ln -s /etc/passwd "$FAKE_REPO/link"
git -C "$FAKE_REPO" add .
git -C "$FAKE_REPO" commit -qm first
export FAKE_HEAD=$(git -C "$FAKE_REPO" rev-parse HEAD)
# Advance the branch after submission: the reviewer must still see FAKE_HEAD.
printf 'later-unsubmitted\n' > "$FAKE_REPO/a.txt"
git -C "$FAKE_REPO" add .
git -C "$FAKE_REPO" commit -qm later
review="$root/scripts/pr-review/review.sh"

# Configuration must fail closed before any review is performed.
for invalid in '' 0 0123 -1 1e3 9007199254740992 999999999999999999999999; do
  if OPENCODE_REVIEWER_ID="$invalid" "$review" 8 101; then echo 'Invalid reviewer ID was accepted' >&2; exit 1; fi
  [[ ! -e $FAKE_STATE/api-called ]] || { echo 'Invalid reviewer ID reached GitHub' >&2; exit 1; }
done
if env -u OPENCODE_REVIEWER_ID "$review" 8 101; then echo 'Missing reviewer ID was accepted' >&2; exit 1; fi
[[ ! -e $FAKE_STATE/api-called ]] || { echo 'Missing reviewer ID reached GitHub' >&2; exit 1; }

UNRELATED_SECRET=secret "$review" 8 101
grep -q 'Please handle my review feedback' "$FAKE_STATE/context"
grep -q '^+after' "$FAKE_STATE/model-diff"
if grep -q 'later-unsubmitted' "$FAKE_STATE/model-diff"; then echo 'A newer branch head was reviewed' >&2; exit 1; fi
[[ $(wc -l < "$FAKE_STATE/calls" | tr -d ' ') == 1 ]]
[[ $(jq 'length' "$FAKE_STATE/comments.json") == 1 ]]
"$review" 8 101
[[ $(jq 'length' "$FAKE_STATE/comments.json") == 1 ]]
"$review" 8 102
[[ $(wc -l < "$FAKE_STATE/calls" | tr -d ' ') == 2 ]]
[[ $(jq 'length' "$FAKE_STATE/manifest") == 0 ]]
grep -q 'Please handle my review feedback 102' "$FAKE_STATE/context"
[[ $(jq 'length' "$FAKE_STATE/comments.json") == 2 ]]

printf 'changed again\n' > "$FAKE_REPO/a.txt"
printf 'changed again\n' > "$FAKE_REPO/b.txt"
git -C "$FAKE_REPO" add .
git -C "$FAKE_REPO" commit -qm second
export FAKE_HEAD=$(git -C "$FAKE_REPO" rev-parse HEAD)
touch "$FAKE_STATE/partial"
"$review" 8 103
jq -e 'length == 2' "$FAKE_STATE/manifest" >/dev/null
jq -e '.[-1].body | contains("incomplete")' "$FAKE_STATE/comments.json" >/dev/null
jq -r '.[-1].body | capture("<!-- aidd-review-v1:(?<data>[A-Za-z0-9+/=]+) -->\\s*$").data | @base64d | fromjson | .files | has("b.txt") | not' "$FAKE_STATE/comments.json" | grep -qx true
rm "$FAKE_STATE/partial"
"$review" 8 104
jq -e 'length == 1 and .[0].path == "b.txt"' "$FAKE_STATE/manifest" >/dev/null

printf 'third\n' > "$FAKE_REPO/a.txt"
git -C "$FAKE_REPO" add .
git -C "$FAKE_REPO" commit -qm third
export FAKE_HEAD=$(git -C "$FAKE_REPO" rev-parse HEAD)
count=$(jq 'length' "$FAKE_STATE/comments.json")
touch "$FAKE_STATE/fail-model"
if "$review" 8 105; then echo 'Model failure was reported as success' >&2; exit 1; fi
[[ $(jq 'length' "$FAKE_STATE/comments.json") == "$count" ]]
rm "$FAKE_STATE/fail-model"
touch "$FAKE_STATE/fail-api"
if "$review" 8 105; then echo 'GitHub failure was reported as success' >&2; exit 1; fi
[[ $(jq 'length' "$FAKE_STATE/comments.json") == "$count" ]]
rm "$FAKE_STATE/fail-api"
touch "$FAKE_STATE/invalid"
if "$review" 8 105; then echo 'Invalid model output was accepted' >&2; exit 1; fi
[[ $(jq 'length' "$FAKE_STATE/comments.json") == "$count" ]]
rm "$FAKE_STATE/invalid"
touch "$FAKE_STATE/fail-post"
if "$review" 8 105; then echo 'GitHub publication failure was reported as success' >&2; exit 1; fi
[[ $(jq 'length' "$FAKE_STATE/comments.json") == "$count" ]]
rm "$FAKE_STATE/fail-post"
"$review" 8 105
[[ $(jq 'length' "$FAKE_STATE/comments.json") == $((count + 1)) ]]
printf 'fourth\n' > "$FAKE_REPO/a.txt"
git -C "$FAKE_REPO" add .
git -C "$FAKE_REPO" commit -qm fourth
export FAKE_HEAD=$(git -C "$FAKE_REPO" rev-parse HEAD)
touch "$FAKE_STATE/fail-post-after"
if "$review" 8 106; then echo 'Lost publication response was reported as success' >&2; exit 1; fi
[[ $(jq 'length' "$FAKE_STATE/comments.json") == $((count + 2)) ]]
rm "$FAKE_STATE/fail-post-after"
"$review" 8 106
[[ $(jq 'length' "$FAKE_STATE/comments.json") == $((count + 2)) ]]
if FAKE_AUTHOR=1 "$review" 8 107; then echo 'Untrusted review was accepted' >&2; exit 1; fi
if FAKE_HEAD_OVERRIDE=not-a-sha "$review" 8 107; then echo 'Invalid submitted commit was accepted' >&2; exit 1; fi
if FAKE_HEAD_OVERRIDE=ffffffffffffffffffffffffffffffffffffffff "$review" 8 107; then echo 'Unavailable submitted commit was replaced' >&2; exit 1; fi
[[ $(jq 'length' "$FAKE_STATE/comments.json") == $((count + 2)) ]]
if GH_REVIEW_TOKEN=write-token "$review" 8 107; then echo 'Write token was accepted for reviewer' >&2; exit 1; fi

# A binary and a gitlink expose no reviewable source through their diff.
printf '\000\001\002' > "$FAKE_REPO/binary.bin"
git -C "$FAKE_REPO" add binary.bin
git -C "$FAKE_REPO" update-index --add --cacheinfo "160000,$FAKE_HEAD,vendor"
git -C "$FAKE_REPO" commit -qm 'add binary and submodule'
export FAKE_HEAD=$(git -C "$FAKE_REPO" rev-parse HEAD)
"$review" 8 108
jq -e 'all(.[]; .path != "binary.bin" and .path != "vendor")' "$FAKE_STATE/manifest" >/dev/null
jq -e '.[-1].body | contains("binary.bin") and contains("vendor") and contains("incomplete")' "$FAKE_STATE/comments.json" >/dev/null
jq -e '.[-1].body | capture("<!-- aidd-review-v1:(?<data>[A-Za-z0-9+/=]+) -->\\s*$").data | @base64d | fromjson | .files | (has("binary.bin") or has("vendor")) | not' "$FAKE_STATE/comments.json" >/dev/null

# Discovery must select the configured account, then revalidate it when dispatching.
discover="$root/scripts/pr-review/discover.sh"
before=$(wc -l < "$FAKE_STATE/calls" | tr -d ' ')
rm "$FAKE_STATE/api-called"
if (cd "$root" && env -u OPENCODE_REVIEWER_ID "$discover"); then echo 'Discovery accepted a missing reviewer ID' >&2; exit 1; fi
if (cd "$root" && OPENCODE_REVIEWER_ID=0 "$discover"); then echo 'Discovery accepted an invalid reviewer ID' >&2; exit 1; fi
[[ ! -e $FAKE_STATE/api-called ]] || { echo 'Invalid reviewer ID reached discovery API' >&2; exit 1; }
(cd "$root" && FAKE_AUTHOR=1 "$discover")
[[ $(wc -l < "$FAKE_STATE/calls" | tr -d ' ') == "$before" ]]
(cd "$root" && "$discover")
[[ $(wc -l < "$FAKE_STATE/calls" | tr -d ' ') == $((before + 1)) ]]

echo 'Review orchestration tests passed'
