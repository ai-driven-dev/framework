#!/usr/bin/env bash
# aidd-async-dev local poll
#
# Wraps `claude -p` invocations of the run and review skills.
# Run on a schedule via cron, launchd, or a Claude Code Desktop scheduled task.
# Idempotent: deduplicated server-side by the `__WORKING_LABEL__` lock label.
# Portable: works on macOS bash 3.2 and on Linux bash 4+.

set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

REPO="__REPO_FULL_NAME__"
TO_IMPLEMENT="__TO_IMPLEMENT_LABEL__"
TO_REVIEW="__TO_REVIEW_LABEL__"
WORKING="__WORKING_LABEL__"
BLOCKED="__BLOCKED_LABEL__"

log() { printf '[aidd-async] %s\n' "$*" >&2; }

invoke_claude() {
  local prompt="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY: claude -p \"$prompt\""
    return 0
  fi
  claude -p \
    --dangerously-skip-permissions \
    "$prompt"
}

is_skipped() {
  local issue="$1"
  local labels
  labels=$(gh issue view "$issue" --repo "$REPO" --json labels --jq '[.labels[].name] | join(",")')
  case ",$labels," in
    *",$WORKING,"*) log "skip #$issue: already $WORKING"; return 0 ;;
    *",$BLOCKED,"*) log "skip #$issue: $BLOCKED"; return 0 ;;
  esac
  return 1
}

process_label() {
  local label="$1"
  local prompt_template="$2"
  local issues
  issues=$(gh issue list \
    --repo "$REPO" \
    --label "$label" \
    --state open \
    --json number \
    --jq '.[].number')
  if [ -z "$issues" ]; then
    log "no open issues with label $label"
    return 0
  fi
  while IFS= read -r issue; do
    [ -n "$issue" ] || continue
    if is_skipped "$issue"; then
      continue
    fi
    log "process #$issue"
    invoke_claude "${prompt_template/\#NUM/#$issue}"
  done <<< "$issues"
}

process_label "$TO_IMPLEMENT" "Use skill aidd-async-dev:02:run on issue #NUM in $REPO"
process_label "$TO_REVIEW" "Use skill aidd-async-dev:03:review for issue #NUM in $REPO"

log "done"
