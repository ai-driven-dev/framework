#!/usr/bin/env bash
set -euo pipefail

# Hand one review to the isolated reviewer with a read-only GitHub token.
[[ $# == 3 ]] || { echo 'Usage: run-review WORKSPACE MANIFEST OUTPUT' >&2; exit 2; }
workspace=$1 manifest=$2 output=$3
: "${GH_REVIEW_TOKEN:?GH_REVIEW_TOKEN is required}"
: "${GH_REPO:?GH_REPO is required}"
: "${REVIEW_PR:?REVIEW_PR is required}"
: "${REVIEW_BASE:?REVIEW_BASE is required}"
: "${REVIEW_HEAD:?REVIEW_HEAD is required}"
[[ -d $workspace && ! -L $workspace && -f $manifest && ! -L $manifest && -f $output && ! -L $output ]] || { echo 'Invalid review inputs' >&2; exit 1; }
work=$(realpath -e "$(dirname "$workspace")")
[[ $work =~ ^/tmp/aidd-review\.[[:alnum:]]{8}$ || $work =~ ^/home/runner/actions-runner/_work/_temp/aidd-review\.[[:alnum:]]{8}$ ]] || { echo 'Invalid review directory' >&2; exit 1; }
[[ $workspace == "$work/input" && $manifest == "$work/manifest.json" && $output == "$work/model-output.json" ]] || { echo 'Unexpected review paths' >&2; exit 1; }
# Refuse stale runner images after any change to the trusted runtime.
for mapping in \
  'scripts/pr-review/model.sh|/opt/aidd/model.sh' \
  'scripts/pr-review/setup-project.sh|/opt/aidd/setup-project' \
  'docker/aidd-opencode/review-prompt.txt|/opt/aidd/review-prompt.txt' \
  'docker/aidd-opencode/runner/Dockerfile|/opt/aidd/source/runner-Dockerfile' \
  'docker/aidd-opencode/runner/Dockerfile.dockerignore|/opt/aidd/source/runner-Dockerfile.dockerignore' \
  'docker/aidd-opencode/runner/policy.json|/etc/opencode/opencode.json' \
  'docker/aidd-opencode/runner/git|/opt/aidd/bin/git' \
  'docker/aidd-opencode/runner/gh|/opt/aidd/bin/gh' \
  'docker/aidd-opencode/runner/gh-read|/opt/aidd/gh-read' \
  'docker/aidd-opencode/runner/dispatch.sh|/opt/aidd/dispatch' \
  'docker/aidd-opencode/runner/run-review.sh|/opt/aidd/run-review' \
  'docker/aidd-opencode/runner/runner.sh|/opt/aidd/runner'; do
  source_path=${mapping%%|*} image_path=${mapping#*|}
  if [[ ! -f $source_path || -L $source_path ]] || ! cmp -s "$source_path" "$image_path"; then
    echo "Reviewer image and trusted checkout differ: $source_path" >&2
    exit 1
  fi
done

inbox=/var/lib/aidd-review/inbox
exec 9>"$inbox/lock"
flock -n 9 || { echo 'Another review is running' >&2; exit 1; }
# Install outside the checkout. The CLI cache can contain the read token, so
# only the translated skills and agents enter the reviewer snapshot.
mkdir -p "$work/install" "$workspace/aidd/skills" "$workspace/aidd/agents"
if ! AIDD_TOKEN="$GH_REVIEW_TOKEN" /opt/aidd/setup-project "$workspace/source" "$work/install" \
    > "$work/setup.log" 2> "$workspace/review-input/setup-notes.txt"; then
  cat "$workspace/review-input/setup-notes.txt" >&2
  echo 'AIDD setup failed' >&2
  exit 1
fi
cat "$workspace/review-input/setup-notes.txt" >&2
for kind in skills agents; do
  if [[ -d $work/install/.opencode/$kind ]]; then
    if [[ -n $(find "$work/install/.opencode/$kind" \( -name .git -o -type l \) -print -quit) ]]; then
      echo 'Translated AIDD tools contain a Git directory or symlink' >&2
      exit 1
    fi
    cp -R "$work/install/.opencode/$kind/." "$workspace/aidd/$kind/"
  fi
done
jq -n --arg work "$work" --arg repo "$GH_REPO" --arg pr "$REVIEW_PR" --arg base "$REVIEW_BASE" --arg head "$REVIEW_HEAD" \
  --arg model "${OPENCODE_REVIEW_MODEL:-openai/gpt-6.1-terra#medium}" \
  '{work:$work,repo:$repo,pr:$pr,base:$base,head:$head,model:$model}' > "$inbox/request.json"
printf '%s\n' "$GH_REVIEW_TOKEN" | sudo -n /opt/aidd/dispatch
cat /var/lib/aidd-review/result.json > "$output"
