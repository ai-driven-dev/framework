#!/usr/bin/env bash
# Backing script for a command hook.
# Reads the event JSON on stdin, does its work, and signals back.
set -euo pipefail

input="$(cat)"

# Read fields from the event JSON, e.g. with jq:
#   tool_name="$(printf '%s' "$input" | jq -r '.tool_name // empty')"

# Do the work here.

# Signal the result the way the target tool reads it: an exit code, and stdout where the tool honors it.
exit 0

# Replace the placeholder logic, then delete the example comments and this note.
