#!/usr/bin/env bash
set -euo pipefail

# Exercise Git and credential boundaries in the built image with a fake GitHub CLI.
image=${TEST_RUNNER_IMAGE:-aidd-review-runner:ci}
docker run --rm -i --user root --entrypoint bash "$image" -s <<'CONTAINER'
set -euo pipefail
cat > /usr/bin/gh <<'GH'
#!/usr/bin/env bash
set -euo pipefail
[[ ${GH_TOKEN:-} == synthetic-read-token ]] || exit 1
printf 'fixture-response %s\n' "$*"
GH
chmod 755 /usr/bin/gh
cat > /opt/aidd/model.sh <<'MODEL'
#!/usr/bin/env bash
set -euo pipefail
export REVIEW_REPO="$1/source"
[[ $(stat -c '%u' "$REVIEW_REPO") == 0 ]] || { echo 'Review checkout is not owned by root' >&2; exit 1; }
/opt/aidd/bin/git diff "$REVIEW_BASE" "$REVIEW_HEAD" > /tmp/review-git-out
grep -q '^-before$' /tmp/review-git-out
grep -q '^+submitted$' /tmp/review-git-out
if grep -q '^+outside$' /tmp/review-git-out; then echo 'Wrong diff returned' >&2; exit 1; fi
outside=$(cat "$1/review-input/outside-sha.txt")
/usr/bin/git -C "$REVIEW_REPO" -c safe.directory="$REVIEW_REPO" cat-file -e "$outside^{commit}"
if /opt/aidd/bin/git diff "$REVIEW_BASE" "$outside" >/dev/null 2>&1; then echo 'Other revision accepted' >&2; exit 1; fi
if /opt/aidd/bin/git diff --no-index /etc/passwd /etc/passwd >/dev/null 2>&1; then echo 'Git no-index accepted' >&2; exit 1; fi
sentinel=synthetic-model-secret
if error=$(/opt/aidd/bin/git diff "$sentinel" 2>&1); then echo 'Invalid Git argument accepted' >&2; exit 1; fi
[[ $error != *"$sentinel"* ]] || { echo 'Git argument error exposed the sentinel' >&2; exit 1; }
if error=$(/opt/aidd/bin/git diff -- ":(unknown$sentinel)" 2>&1); then echo 'Invalid Git pathspec accepted' >&2; exit 1; fi
[[ $error != *"$sentinel"* ]] || { echo 'Git pathspec error exposed the sentinel' >&2; exit 1; }
[[ -z ${GH_TOKEN:-} && -z ${GH_REVIEW_TOKEN:-} && -z ${AIDD_TOKEN:-} ]] || { echo 'Reviewer received a GitHub token' >&2; exit 1; }
[[ -n ${AIDD_REVIEW_JOB:-} && ! -r $AIDD_REVIEW_JOB/token ]] || { echo 'Reviewer can read GitHub token' >&2; exit 1; }
[[ ! -w $AIDD_REVIEW_JOB && ! -w $AIDD_REVIEW_JOB/metadata.json && ! -w $AIDD_REVIEW_JOB/token ]] || { echo 'Reviewer can change job credentials or metadata' >&2; exit 1; }
if ( printf '{}\n' > "$AIDD_REVIEW_JOB/metadata.json" ) 2>/dev/null; then echo 'Metadata replaced' >&2; exit 1; fi
if ( rm "$AIDD_REVIEW_JOB/token" ) 2>/dev/null; then echo 'Token replaced' >&2; exit 1; fi
/opt/aidd/bin/gh pr view 8 --repo test/repo --comments > /tmp/review-gh-out
grep -q 'fixture-response api repos/test/repo/pulls/8' /tmp/review-gh-out
grep -q 'fixture-response api --paginate repos/test/repo/pulls/8/comments?per_page=100' /tmp/review-gh-out
/opt/aidd/bin/gh api --paginate 'repos/test/repo/pulls/8/comments?per_page=100' >/dev/null
if /opt/aidd/bin/gh api -X POST repos/test/repo/pulls/8/comments >/dev/null 2>&1; then echo 'Write accepted' >&2; exit 1; fi
if /opt/aidd/bin/gh api repos/test/other/pulls/8 >/dev/null 2>&1; then echo 'Other repository accepted' >&2; exit 1; fi
if /opt/aidd/bin/gh pr view 9 --repo test/repo >/dev/null 2>&1; then echo 'Other PR accepted' >&2; exit 1; fi
if error=$(/opt/aidd/bin/gh api 'repos/test/repo/pulls/8?unexpected=synthetic-read-token' 2>&1); then echo 'Unexpected query accepted' >&2; exit 1; fi
[[ $error != *synthetic-read-token* ]] || { echo 'Error echoed a credential-like argument' >&2; exit 1; }
if error=$(/usr/bin/sudo -n -u runner /opt/aidd/gh-read "$AIDD_REVIEW_JOB/../synthetic-read-token" api repos/test/repo/pulls/8 2>&1); then echo 'Unsafe job accepted' >&2; exit 1; fi
[[ $error != *synthetic-read-token* ]] || { echo 'Error echoed an invalid job path' >&2; exit 1; }
jq -n '{report:"fixture",reviewed:[]}' > "$3"
MODEL
chmod 755 /opt/aidd/model.sh
work=$(runuser -u runner -- mktemp -d /tmp/aidd-review.XXXXXXXX)
runuser -u runner -- mkdir -p "$work/input/source" "$work/input/review-input"
runuser -u runner -- git -C "$work/input/source" init -q
runuser -u runner -- git -C "$work/input/source" config user.name 'Review test'
runuser -u runner -- git -C "$work/input/source" config user.email 'review-test@example.invalid'
runuser -u runner -- sh -c 'printf "before\n" > "$1/source.txt"' _ "$work/input/source"
runuser -u runner -- git -C "$work/input/source" add source.txt
runuser -u runner -- git -C "$work/input/source" commit -qm base
base=$(runuser -u runner -- git -C "$work/input/source" rev-parse HEAD)
runuser -u runner -- sh -c 'printf "submitted\n" > "$1/source.txt"' _ "$work/input/source"
runuser -u runner -- git -C "$work/input/source" commit -qam submitted
head=$(runuser -u runner -- git -C "$work/input/source" rev-parse HEAD)
runuser -u runner -- sh -c 'printf "outside\n" > "$1/source.txt"' _ "$work/input/source"
runuser -u runner -- git -C "$work/input/source" commit -qam outside
outside=$(runuser -u runner -- git -C "$work/input/source" rev-parse HEAD)
runuser -u runner -- git -C "$work/input/source" checkout -q --detach "$head"
printf '%s\n' "$outside" | runuser -u runner -- sh -c 'cat > "$1/review-input/outside-sha.txt"' _ "$work/input"
runuser -u runner -- sh -c 'printf "[]\n" > "$1/manifest.json"' _ "$work"
request=$(jq -n --arg work "$work" --arg base "$base" --arg head "$head" '{work:$work,repo:"test/repo",pr:"8",base:$base,head:$head}')
printf '%s\n' "$request" | runuser -u runner -- sh -c 'cat > /var/lib/aidd-review/inbox/request.json'
printf 'synthetic-read-token\n' | runuser -u runner -- sudo -n /opt/aidd/dispatch
jq -e '.report == "fixture"' /var/lib/aidd-review/result.json >/dev/null
echo 'Git and GitHub read boundary tests passed'
CONTAINER
