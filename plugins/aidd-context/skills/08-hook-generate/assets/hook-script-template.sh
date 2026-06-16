#!/usr/bin/env bash
# Backing script for a command hook.
# Reads the event JSON on stdin, does its work, and signals back via exit code + stdout.
set -euo pipefail

input="$(cat)"

# Read fields from the event JSON, e.g. with jq:
#   tool_name="$(printf '%s' "$input" | jq -r '.tool_name // empty')"

# Do the work here.

# Exit 0 = success. Stdout (JSON) steers the session; see references/hook-authoring.md.
# Exit 2 = blocking error on an event that honors it; stderr surfaces to the model.
exit 0
