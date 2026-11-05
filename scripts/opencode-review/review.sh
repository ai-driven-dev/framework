#!/usr/bin/env bash
set -euo pipefail

prompt="$GITHUB_WORKSPACE/trusted/scripts/opencode-review/prompt.txt"
opencode run --standalone --auto --format json --model 'openai/gpt-6.1-terra#medium' \
  "$(cat "$prompt")" > "$RUNNER_TEMP/opencode-review-events.jsonl"
