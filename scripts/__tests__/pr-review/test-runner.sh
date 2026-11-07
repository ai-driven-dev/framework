#!/usr/bin/env bash
set -euo pipefail

# Exercise Git and credential boundaries in the built image with a fake GitHub CLI.
image=${TEST_RUNNER_IMAGE:-aidd-review-runner:ci}
docker run --rm -i --user root --cap-drop ALL --cap-add SETUID --cap-add SETGID \
  --cap-add CHOWN --cap-add AUDIT_WRITE --cap-add DAC_OVERRIDE --cap-add KILL \
  --entrypoint bash "$image" -s <<'CONTAINER'
set -euo pipefail
cp /opt/aidd/model.sh /tmp/real-model.sh
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
[[ ${OPENCODE_REVIEW_MODEL:-} == 'other-provider/another-model#medium' ]] || { echo 'Configured review model was not propagated' >&2; exit 1; }
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
# Exercise run-review -> dispatch with a synthetic installer and a complete trusted checkout.
cat > /opt/aidd/setup-project <<'SETUP'
#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$2/.opencode/skills" "$2/.opencode/agents"
SETUP
chmod 755 /opt/aidd/setup-project
mkdir -p "$work/trusted/scripts/pr-review" "$work/trusted/docker/aidd-opencode/runner"
while IFS='|' read -r source image_file; do
  cp "$image_file" "$work/trusted/$source"
done <<'FILES'
scripts/pr-review/model.sh|/opt/aidd/model.sh
scripts/pr-review/setup-project.sh|/opt/aidd/setup-project
docker/aidd-opencode/review-prompt.txt|/opt/aidd/review-prompt.txt
docker/aidd-opencode/runner/Dockerfile|/opt/aidd/source/runner-Dockerfile
docker/aidd-opencode/runner/Dockerfile.dockerignore|/opt/aidd/source/runner-Dockerfile.dockerignore
docker/aidd-opencode/runner/policy.json|/etc/opencode/opencode.json
docker/aidd-opencode/runner/git|/opt/aidd/bin/git
docker/aidd-opencode/runner/gh|/opt/aidd/bin/gh
docker/aidd-opencode/runner/gh-read|/opt/aidd/gh-read
docker/aidd-opencode/runner/dispatch.sh|/opt/aidd/dispatch
docker/aidd-opencode/runner/run-review.sh|/opt/aidd/run-review
docker/aidd-opencode/runner/runner.sh|/opt/aidd/runner
FILES
runuser -u runner -- touch "$work/model-output.json"
runuser -u runner -- env GH_REVIEW_TOKEN=synthetic-read-token GH_REPO=test/repo REVIEW_PR=8 \
  REVIEW_BASE="$base" REVIEW_HEAD="$head" OPENCODE_REVIEW_MODEL='other-provider/another-model#medium' \
  bash -c 'cd "$1"; /opt/aidd/run-review "$2/input" "$2/manifest.json" "$2/model-output.json"' _ "$work/trusted" "$work"
jq -e '.report == "fixture"' "$work/model-output.json" >/dev/null
request=$(jq -n --arg work "$work" --arg base "$base" --arg head "$head" '{work:$work,repo:"test/repo",pr:"8",base:$base,head:$head,model:"other-provider/another-model#medium"}')

# The privileged dispatcher must reject options and control characters in model IDs.
for bad in '-unsafe' $'vendor/model\n--unsafe'; do
  request=$(jq --arg model "$bad" '.model = $model' <<<"$request")
  printf '%s\n' "$request" | runuser -u runner -- sh -c 'cat > /var/lib/aidd-review/inbox/request.json'
  if printf 'synthetic-read-token\n' | runuser -u runner -- sudo -n /opt/aidd/dispatch >/dev/null 2>&1; then
    echo 'Invalid review model accepted' >&2; exit 1
  fi
done

# Exercise model.sh itself against a fake OpenCode executable to check its argv.
mkdir -p /tmp/model-case/source /tmp/model-case/review-input /tmp/model-output
printf 'context\n' > /tmp/model-case/review-input/pr-context.txt
printf '[]\n' > /tmp/model-case/manifest.json
printf 'prompt\n' > /tmp/model-case/prompt.txt
printf '{}\n' > /tmp/model-case/policy.json
chmod -R a-w /tmp/model-case
chown reviewer:reviewer /tmp/model-output
cat > /tmp/fake-opencode <<'OPENCODE'
#!/usr/bin/env bash
set -euo pipefail
found=0
while (($#)); do
  if [[ $1 == --model ]]; then shift; [[ ${1:-} == "$EXPECTED_MODEL" ]]; found=1; fi
  shift
done
[[ $found == 1 ]]
printf '%s\n' '{"type":"text","part":{"text":"Review complete.\nAIDD_REVIEW_COVERAGE_V1: {\"reviewed\":[]}"}}'
OPENCODE
chmod 755 /tmp/fake-opencode
runuser -u reviewer -- env -i HOME=/home/aidd PATH=/usr/local/bin:/usr/bin:/bin \
  GH_REPO=test/repo REVIEW_PR=8 REVIEW_BASE="$base" REVIEW_HEAD="$head" \
  OPENCODE_REVIEW_MODEL='other-provider/another-model#medium' EXPECTED_MODEL='other-provider/another-model#medium' \
  bash -c 'source /tmp/real-model.sh; model_main /tmp/model-case /tmp/model-case/manifest.json /tmp/model-output/result.json /tmp/model-case/policy.json /tmp/model-case/prompt.txt /tmp/fake-opencode'
jq -e '.report == "Review complete."' /tmp/model-output/result.json >/dev/null
runuser -u reviewer -- env -i HOME=/home/aidd PATH=/usr/local/bin:/usr/bin:/bin \
  GH_REPO=test/repo REVIEW_PR=8 REVIEW_BASE="$base" REVIEW_HEAD="$head" \
  EXPECTED_MODEL='openai/gpt-6.1-terra#medium' \
  bash -c 'source /tmp/real-model.sh; model_main /tmp/model-case /tmp/model-case/manifest.json /tmp/model-output/result.json /tmp/model-case/policy.json /tmp/model-case/prompt.txt /tmp/fake-opencode'
echo 'Git and GitHub read boundary tests passed'
CONTAINER
