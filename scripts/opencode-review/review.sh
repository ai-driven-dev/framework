#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
workspace="$(cd -- "$1" && pwd -P)"
skill="$script_dir/../../plugins/aidd-dev/skills/05-review"
if git -C "$workspace" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo 'Review workspace must be outside a Git worktree.' >&2
  exit 1
fi
if [[ "${REVIEW_REPOSITORY:-}" != ai-driven-dev/framework || ! "${REVIEW_HEAD:-}" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Invalid review repository or commit.' >&2
  exit 1
fi
: "${REVIEW_CACHE:?Missing review cache}"
if [[ ! -d "$REVIEW_CACHE/snapshot" ]]; then
  # curl 7.x cannot enforce --max-filesize when the server omits Content-Length.
  ( ulimit -f 102400; curl --fail --silent --show-error --location --max-time 120 --max-filesize 100000000 \
      --output "$REVIEW_CACHE/snapshot.tar.gz" \
      "https://codeload.github.com/$REVIEW_REPOSITORY/tar.gz/$REVIEW_HEAD" )
  PYTHONDONTWRITEBYTECODE=1 python3 "$script_dir/snapshot.py" "$REVIEW_CACHE/snapshot.tar.gz" "$REVIEW_CACHE/snapshot.tmp"
  mv "$REVIEW_CACHE/snapshot.tmp" "$REVIEW_CACHE/snapshot"
fi
cp -R "$REVIEW_CACHE/snapshot/." "$workspace/"
mkdir -p "$workspace/.opencode/skills"
cp -R "$skill" "$workspace/.opencode/skills/05-review"
cp "$script_dir/policy.json" "$workspace/opencode.json"
cd -- "$workspace"
export PWD="$workspace" OPENCODE_PURE=1
exec opencode run --standalone --auto --agent review --format json --model 'openai/gpt-6.1-terra#medium' \
  "$(cat "$script_dir/prompt.txt")" > "$workspace/events.jsonl"
