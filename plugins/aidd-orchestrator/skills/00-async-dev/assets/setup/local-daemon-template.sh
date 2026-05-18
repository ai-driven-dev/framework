#!/usr/bin/env bash
# aidd-orchestrator local daemon
#
# Long-running poll loop. Runs `aidd-async-poll.sh` every N seconds.
# Designed to be supervised by tmux / launchd / systemd / nohup, NOT by Claude Code's
# Scheduled Tasks (which have a strict per-account quota). Each tick fires a fresh
# `claude -p` only when there is something to do.
#
# Usage:
#   ./scripts/aidd-async-daemon.sh                    # default: 300s between ticks
#   ./scripts/aidd-async-daemon.sh 600                # custom interval (seconds)
#   tmux new -s aidd "./scripts/aidd-async-daemon.sh"  # detached session
#
# Stop: kill the supervising session (tmux kill-session -t aidd, launchctl unload ..., etc.).
# This script is idempotent and resumable; the run/review skills handle their own locks.

set -euo pipefail

INTERVAL="${1:-300}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLL="$SCRIPT_DIR/aidd-async-poll.sh"

if [ ! -x "$POLL" ]; then
  echo "[aidd-daemon] missing poll script at $POLL" >&2
  exit 1
fi

trap 'echo "[aidd-daemon] stop signal received; exiting"; exit 0' INT TERM

echo "[aidd-daemon] start, interval=${INTERVAL}s"
while true; do
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[aidd-daemon] tick $ts"
  "$POLL" || echo "[aidd-daemon] poll exited non-zero (continuing)"
  sleep "$INTERVAL"
done
