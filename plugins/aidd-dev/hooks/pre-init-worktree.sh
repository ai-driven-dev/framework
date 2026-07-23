#!/usr/bin/env sh
# Prepare a fresh Codex worktree before the task starts.
# Installed by scripts/dev-sync.sh at ~/.aidd/hooks/pre-init-worktree.sh.
set -eu

remote="${AIDD_WORKTREE_REMOTE:-origin}"
base_branch="${AIDD_WORKTREE_BASE_BRANCH:-main}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '%s\n' 'pre-init-worktree: expected a Git worktree.' >&2
  exit 1
fi

current_branch="$(git branch --show-current)"
if [ -n "$current_branch" ]; then
  printf '%s\n' "pre-init-worktree: refusing to move named branch '$current_branch'." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'pre-init-worktree: refusing to reset a dirty worktree.' >&2
  exit 1
fi

git fetch --prune "$remote" "$base_branch"
git switch --detach "$remote/$base_branch"
"${MAKE:-make}" install setup
