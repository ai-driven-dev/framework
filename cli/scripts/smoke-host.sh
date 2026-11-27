#!/usr/bin/env bash
# Sourced by the host smoke scripts: result counters and the sandboxed project they all start from.
# The caller sets ROOT, FRAMEWORK, CLI, TMP and WS before `smoke_setup`.

FAIL=0
pass() { echo "  PASS  $1"; echo "        $2"; }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

# smoke_setup <setup flag> <host id> <file the setup must write>...
smoke_setup() {
  local flag="$1" host="$2"; shift 2
  mkdir -p "$WS/aidd_docs/memory"
  printf '# Architecture\n' >"$WS/aidd_docs/memory/architecture.md"
  printf '# Project\n\n## Memory Management\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n' >"$WS/AGENTS.md"
  git -C "$WS" init -q
  git -C "$WS" -c user.email=smoke@aidd -c user.name=smoke commit -q --allow-empty -m init

  if ! (cd "$WS" && node "$CLI" setup --source local --path "$FRAMEWORK" "$flag" "$host" --plugins recommended --yes) >"$TMP/setup.log" 2>&1; then
    echo "FATAL: aidd setup failed"; tail -5 "$TMP/setup.log"; exit 1
  fi
  local f
  for f in "$@"; do
    [[ -f "$WS/$f" ]] || { echo "FATAL: setup did not write $f"; exit 1; }
  done
}

smoke_assert_memory() {
  local line
  line="$(grep -m1 'aidd_docs/memory/architecture.md' "$WS/AGENTS.md")"
  [[ -n "$line" ]] && pass "memory refreshed at the repo root" "AGENTS.md: $line" || fail "memory: AGENTS.md block still empty, the memory hook did not run at the repo root"
}

# smoke_finish <script name>
smoke_finish() {
  echo
  [[ "$FAIL" -eq 0 ]] && { echo "$1: all passed"; exit 0; }
  echo "$1: $FAIL failed"; exit 1
}
