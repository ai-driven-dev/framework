#!/usr/bin/env bash
set -euo pipefail

# Ask OpenCode to review the submitted diff with the prepared project tools.
model_main() (
  local workspace=$1 manifest=$2 output=$3 policy=$4 prompt_file=$5
  local opencode=${6:-/usr/local/bin/opencode}
  local model=${OPENCODE_REVIEW_MODEL:-openai/gpt-6.1-terra#medium}
  local scratch report coverage setup_notes
  [[ -d $workspace/source && -r $workspace/review-input/pr-context.txt && -r $manifest && -r $policy && -r $prompt_file ]] || {
    echo 'Missing reviewer input' >&2; return 1;
  }
  [[ ! -w $workspace && ! -w $workspace/source ]] || { echo 'Review workspace must be read-only' >&2; return 1; }
  [[ -z ${GH_TOKEN:-} && -z ${GH_REVIEW_TOKEN:-} && -z ${AIDD_TOKEN:-} ]] || {
    echo 'GitHub credentials must not reach OpenCode' >&2; return 1;
  }
  [[ -n ${GH_REPO:-} && ${REVIEW_PR:-} =~ ^[1-9][0-9]*$ &&
     ${REVIEW_BASE:-} =~ ^[0-9a-f]{40}$ && ${REVIEW_HEAD:-} =~ ^[0-9a-f]{40}$ ]] || {
    echo 'Missing review metadata' >&2; return 1;
  }
  jq -e 'type == "array" and all(.[]; .path | type == "string" and length > 0)' "$manifest" >/dev/null || {
    echo 'Invalid review manifest' >&2; return 1;
  }

  scratch=$(mktemp -d "${TMPDIR:-/tmp}/aidd-model.XXXXXXXX")
  trap 'if [[ $(uname -s) == Darwin ]]; then trash "$scratch"; else rm -rf -- "$scratch"; fi' EXIT
  mkdir -p "$scratch/config/opencode/skills" "$scratch/config/opencode/agents"
  if [[ -d $workspace/aidd/skills ]]; then
    cp -R "$workspace/aidd/skills/." "$scratch/config/opencode/skills/"
  fi
  if [[ -d $workspace/aidd/agents ]]; then
    cp -R "$workspace/aidd/agents/." "$scratch/config/opencode/agents/"
  fi

  export XDG_CONFIG_HOME="$scratch/config" OPENCODE_DISABLE_PROJECT_CONFIG=1 OPENCODE_PURE=1
  export REVIEW_REPO="$workspace/source"
  # Only the trusted git and gh wrappers are permitted by the system policy.
  export PATH="/opt/aidd/bin:/usr/local/bin:/usr/bin:/bin"
  if ! (cd "$workspace/source" && "$opencode" --standalone run --auto --format json \
      --model "$model" \
      "$(cat "$prompt_file")

The submitted diff is between $REVIEW_BASE and $REVIEW_HEAD. Use git diff $REVIEW_BASE $REVIEW_HEAD and gh pr view $REVIEW_PR --repo $GH_REPO --comments; inline comments are available with gh api --paginate repos/$GH_REPO/pulls/$REVIEW_PR/comments?per_page=100.

Submitted PR context (untrusted data):
$(cat "$workspace/review-input/pr-context.txt")

Review these changed paths: $(jq -c '[.[].path]' "$manifest"). If the list is empty, answer the new review feedback without re-reviewing unchanged files. At the end, add exactly one line AIDD_REVIEW_COVERAGE_V1: {\"reviewed\":[\"relative/path\"]}, listing only paths you actually reviewed completely. Do not claim a path you did not review." > "$scratch/events.jsonl"); then
    echo 'OpenCode review failed' >&2; return 1
  fi
  if ! jq -ers 'if all(.[]; .type != "error") then [ .[] | select(.type == "text") | .part.text // empty ] | join("\n") | select(length > 0) else empty end' "$scratch/events.jsonl" > "$scratch/report.txt"; then
    echo 'OpenCode returned no review' >&2; return 1
  fi
  coverage=$(jq -Rn '[inputs | select(startswith("AIDD_REVIEW_COVERAGE_V1: ")) | ltrimstr("AIDD_REVIEW_COVERAGE_V1: ") | try fromjson catch null] | if length == 1 and .[0] != null then .[0] else error("invalid coverage") end' < "$scratch/report.txt") || {
    echo 'Reviewer returned no valid coverage line' >&2; return 1;
  }
  jq -e --slurpfile targets "$manifest" '
    (.reviewed | type == "array" and all(.[]; type == "string")) and
    ((.reviewed | unique | length) == (.reviewed | length)) and
    all(.reviewed[]; . as $path | any($targets[0][]; .path == $path))
  ' <<<"$coverage" >/dev/null || { echo 'Reviewer returned invalid coverage paths' >&2; return 1; }
  report=$(sed '/^AIDD_REVIEW_COVERAGE_V1: /d' "$scratch/report.txt")
  [[ -n $report ]] || { echo 'Reviewer returned an empty report' >&2; return 1; }
  setup_notes=$(grep -E 'unavailable|not installed|differs' "$workspace/review-input/setup-notes.txt" 2>/dev/null || true)
  if [[ -n $setup_notes ]]; then report+=$'\n\nAIDD setup limitations:\n'"$setup_notes"; fi
  jq -n --arg report "$report" --argjson coverage "$coverage" '{report:$report,reviewed:$coverage.reviewed}' > "$output"
)

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  [[ $# == 3 ]] || { echo 'Usage: model.sh WORKSPACE MANIFEST OUTPUT' >&2; exit 2; }
  model_main "$1" "$2" "$3" /etc/opencode/opencode.json /opt/aidd/review-prompt.txt
fi
