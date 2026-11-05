#!/usr/bin/env bash
set -euo pipefail

[[ $# == 3 ]] || { echo 'Usage: run-review WORKSPACE MANIFEST OUTPUT' >&2; exit 2; }
workspace=$1 manifest=$2 output=$3
[[ -d $workspace && ! -L $workspace && -f $manifest && ! -L $manifest && -f $output && ! -L $output ]] || { echo 'Invalid review inputs' >&2; exit 1; }
work=$(realpath -e "$(dirname "$workspace")")
[[ $work =~ ^/tmp/aidd-review\.[[:alnum:]]{8}$ || $work =~ ^/home/runner/actions-runner/_work/_temp/aidd-review\.[[:alnum:]]{8}$ ]] || { echo 'Invalid review directory' >&2; exit 1; }
[[ $workspace == "$work/input" && $manifest == "$work/manifest.json" && $output == "$work/model-output.json" ]] || { echo 'Unexpected review paths' >&2; exit 1; }
# Refuse stale runner images after any change to the trusted runtime.
for mapping in \
  'scripts/pr-review/model.sh|/opt/aidd/model.sh' \
  'docker/aidd-opencode/review-prompt.txt|/opt/aidd/review-prompt.txt' \
  'docker/aidd-opencode/Dockerfile|/opt/aidd/source/base-Dockerfile' \
  'docker/aidd-opencode/runner/Dockerfile|/opt/aidd/source/runner-Dockerfile' \
  'docker/aidd-opencode/runner/Dockerfile.dockerignore|/opt/aidd/source/runner-Dockerfile.dockerignore' \
  'docker/aidd-opencode/runner/policy.json|/etc/opencode/opencode.json' \
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
printf '%s\n' "$work" > "$inbox/current"
sudo -n /opt/aidd/dispatch </dev/null
cat /var/lib/aidd-review/result.json > "$output"
