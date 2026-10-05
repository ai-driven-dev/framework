#!/usr/bin/env bash
# Runtime smoke against a real, logged-in `agy`: after `aidd setup --ai antigravity`, the host
# itself expands an AIDD skill, loads and fires the memory hook, and lists an AIDD agent.
# Local only, never in CI or lefthook: a turn needs a Google login. `pnpm smoke:antigravity`.
#
# Measured on agy 1.2.17, and why the script reads logs instead of waiting on a turn:
# - print mode (`-p`) fires no hook, so the hook session runs interactive under a pty
#   (`script`), with `--add-dir` (without it, 0 hooks load);
# - an interactive turn never returns, so that session is killed after a bound, and only its
#   log lines and the files it touched count as evidence;
# - an interactive initial prompt is sent as text, never expanded, so the skill and
#   `/agents` checks use print mode, bounded by `--print-timeout`.
#
# The project is a throwaway git repo; HOME stays real because the login lives there, but
# `AIDD_USER_CONFIG_DIR` is relocated so setup never touches the real aidd profile.
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

LOG="$TMP/agy-session.log"
(cd "$WS" && exec script -q /dev/null agy -i "reply OK" --mode plan --add-dir "$WS" --log-file "$LOG") \
  >"$TMP/agy-session.out" 2>&1 &
SESSION_PID=$!

for ((i = 0; i < TURN_SECONDS; i++)); do
  grep -q 'aidd_docs/memory/architecture.md' "$WS/AGENTS.md" && break
  sleep 1
done
pkill -P "$SESSION_PID" 2>/dev/null
kill "$SESSION_PID" 2>/dev/null
wait "$SESSION_PID" 2>/dev/null
SESSION_PID=""

# Startup logs "not logged into Antigravity" before the stored login is read, so only a missing
# success line means no login.
if ! grep -q "OAuth: authenticated successfully" "$LOG" 2>/dev/null; then
  echo "FATAL: agy is not logged in — run 'agy' once and sign in"; exit 1
fi

line="$(grep -Eo 'loaded [1-9][0-9]* named hooks from [0-9]+ hooks.json file\(s\)' "$LOG" 2>/dev/null | head -1)"
[[ -n "$line" ]] && pass "hooks loaded" "$line" || fail "hooks: no 'loaded N named hooks' line (N >= 1) in the agy log"

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
