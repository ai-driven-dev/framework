#!/usr/bin/env bash
# Runtime smoke against a real, logged-in `agy`: after `aidd setup --ai antigravity`, the host
# loads and fires the project memory hook, expands an AIDD skill, and lists an AIDD agent.
# Local only, never in CI or lefthook: a turn needs a Google login. `pnpm smoke:antigravity`.
#
# The hook sessions run interactive under a pty, killed after a bound: older `agy` fired no hook in
# print mode (`-p`), and a print turn waits on every user MCP server. Its log and the files it
# touched are the evidence. HOME stays real for the login; `AIDD_USER_CONFIG_DIR` is relocated so
# setup never touches the real aidd profile.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMEWORK="$(cd "$ROOT/.." && pwd)"
CLI="$ROOT/dist/cli.js"
TURN_SECONDS="${SMOKE_AGY_TIMEOUT:-60}"

SKILL="aidd-context-11-explore"
AGENT="aidd-dev-executor"
GHOST_AGENT="aidd-dev-ghost"

command -v agy >/dev/null 2>&1 || { echo "FATAL: agy not on PATH — install Antigravity CLI and log in"; exit 1; }
[[ -f "$CLI" ]] || { echo "FATAL: $CLI missing — run 'pnpm build' first"; exit 1; }

TMP="$(mktemp -d)"
WS="$TMP/project"
SESSION_PID=""
cleanup() {
  if [[ -n "$SESSION_PID" ]]; then
    pkill -P "$SESSION_PID" 2>/dev/null
    kill "$SESSION_PID" 2>/dev/null
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

export AIDD_USER_CONFIG_DIR="$TMP/aidd-config"
export AIDD_SKIP_UPDATE_CHECK=1

# Under a pseudo-terminal: util-linux script(1) takes the command as one -c string, BSD as arguments.
pty_run() {
  if script --version >/dev/null 2>&1; then
    script -qec "$(printf '%q ' "$@")" /dev/null
  else
    script -q /dev/null "$@"
  fi
}

# How many named hooks agy loads, from its log: user-global hooks included.
hook_count() { grep -Eo 'loaded [0-9]+ named hooks' "$1" 2>/dev/null | head -1 | grep -Eo '[0-9]+'; }

FAIL=0
pass() { echo "  PASS  $1"; echo "        $2"; }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

echo "agy $(agy --version 2>&1 | head -1), $(date '+%Y-%m-%d %H:%M %Z')"

# A project with a memory bank and an empty memory block, so the hook has something to fill.
mkdir -p "$WS/aidd_docs/memory"
printf '# Architecture\n' >"$WS/aidd_docs/memory/architecture.md"
printf '# Project\n\n## Memory Management\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n' >"$WS/AGENTS.md"
git -C "$WS" init -q
git -C "$WS" -c user.email=smoke@aidd -c user.name=smoke commit -q --allow-empty -m init

if ! (cd "$WS" && node "$CLI" setup --source local --path "$FRAMEWORK" --ai antigravity --plugins recommended --yes) >"$TMP/setup.log" 2>&1; then
  echo "FATAL: aidd setup failed"; tail -5 "$TMP/setup.log"; exit 1
fi
for f in ".agents/skills/$SKILL/SKILL.md" ".agents/hooks.json" ".agents/agents/$AGENT/agent.md"; do
  [[ -f "$WS/$f" ]] || { echo "FATAL: setup did not write $f"; exit 1; }
done

# One interactive session logging to $1, killed once `$2…` succeeds or the bound runs out.
session() {
  local log="$1"; shift
  (cd "$WS" && pty_run agy -i "reply OK" --mode plan --add-dir "$WS" --log-file "$log") >"$log.out" 2>&1 &
  SESSION_PID=$!
  for ((i = 0; i < TURN_SECONDS; i++)); do
    "$@" && break
    sleep 1
  done
  pkill -P "$SESSION_PID" 2>/dev/null
  kill "$SESSION_PID" 2>/dev/null
  wait "$SESSION_PID" 2>/dev/null
  SESSION_PID=""
}

LOG="$TMP/agy-session.log"
session "$LOG" grep -q 'aidd_docs/memory/architecture.md' "$WS/AGENTS.md"

# Startup logs "not logged into Antigravity" before the stored login is read, so only a missing
# success line means no login.
if ! grep -q "OAuth: authenticated successfully" "$LOG" 2>/dev/null; then
  echo "FATAL: agy is not logged in — run 'agy' once and sign in"; exit 1
fi

# The log never names a hook, and user-global hooks count too, so the project's own are proven by
# difference: the same session, in the same mode, without .agents/hooks.json must load fewer.
BASE_LOG="$TMP/agy-baseline.log"
[[ -f "$WS/.agents/hooks.json" ]] && mv "$WS/.agents/hooks.json" "$TMP/hooks.json"
session "$BASE_LOG" grep -qs 'named hooks' "$BASE_LOG"
[[ -f "$TMP/hooks.json" ]] && mv "$TMP/hooks.json" "$WS/.agents/hooks.json"
with="$(hook_count "$LOG")"
without="$(hook_count "$BASE_LOG")"
if [[ -n "$with" && -n "$without" && "$with" -gt "$without" ]]; then
  pass "project hooks loaded" "$with named hooks with .agents/hooks.json, $without without"
else
  fail "hooks: .agents/hooks.json adds no loaded hook (${with:-?} with, ${without:-?} without)"
fi

line="$(grep -m1 'aidd_docs/memory/architecture.md' "$WS/AGENTS.md")"
[[ -n "$line" ]] && pass "memory refreshed at the repo root" "AGENTS.md: $line" || fail "memory: AGENTS.md block still empty, the SessionStart hook did not run at the repo root"

# The expansion is logged before the model answers, so a short bound is enough.
SKILL_LOG="$TMP/agy-skill.log"
(cd "$WS" && agy --add-dir "$WS" --mode plan --print-timeout 20s --log-file "$SKILL_LOG" -p "/$SKILL") >/dev/null 2>&1
line="$(grep -o "expanded slash command \"$SKILL\" (skill)" "$SKILL_LOG" 2>/dev/null | head -1)"
[[ -n "$line" ]] && pass "skill expanded" "$line" || fail "skill: no 'expanded slash command \"$SKILL\"' line in the agy log"

# Print mode answers /agents without the model.
AGENTS_JSON="$TMP/agents.json"
(cd "$WS" && agy --add-dir "$WS" --output-format json --print-timeout "${TURN_SECONDS}s" -p "/agents") >"$AGENTS_JSON" 2>&1
line="$(grep -o "\"$AGENT\"" "$AGENTS_JSON" | head -1)"
if [[ -n "$line" ]] && ! grep -q "\"$GHOST_AGENT\"" "$AGENTS_JSON"; then
  pass "agent listed" "/agents: $line, $GHOST_AGENT absent"
else
  fail "agents: /agents does not list \"$AGENT\" (or lists the invented $GHOST_AGENT)"
fi

echo
[[ "$FAIL" -eq 0 ]] && { echo "smoke-antigravity: all passed"; exit 0; }
echo "smoke-antigravity: $FAIL failed"; exit 1
