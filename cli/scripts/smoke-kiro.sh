#!/usr/bin/env bash
# Runtime smoke against a real, logged-in `kiro-cli`: after `aidd setup --ide kiro`, one headless
# CLI V3 turn offers every installed AIDD skill, runs under an AIDD agent and fires the project
# memory hook. Local only, never in CI or lefthook: a turn needs a Kiro login. `pnpm smoke:kiro`.
#
# The turn's own events (`--output-format stream-json`) and the files it touched are the evidence,
# never the model's words. HOME stays real for the login; `AIDD_USER_CONFIG_DIR` is relocated so
# setup never touches the real aidd profile, and the chat the turn saved is deleted on exit.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMEWORK="$(cd "$ROOT/.." && pwd)"
CLI="$ROOT/dist/cli.js"
TURN_SECONDS="${SMOKE_KIRO_TIMEOUT:-180}"

SKILL="aidd-context-11-explore"
AGENT="aidd-orchestrator-executor"
GHOST="aidd-orchestrator-ghost"

command -v kiro-cli >/dev/null 2>&1 || { echo "FATAL: kiro-cli not on PATH: install Kiro CLI and log in"; exit 1; }
[[ -f "$CLI" ]] || { echo "FATAL: $CLI missing: run 'pnpm build' first"; exit 1; }
kiro-cli whoami >/dev/null 2>&1 || { echo "FATAL: kiro-cli is not logged in: run 'kiro-cli login'"; exit 1; }

TMP="$(mktemp -d)"
WS="$TMP/project"
TURN_PID=""
SESSION=""
cleanup() {
  [[ -n "$TURN_PID" ]] && kill "$TURN_PID" 2>/dev/null
  [[ -n "$SESSION" ]] && (cd "$WS" && kiro-cli chat --delete-session "$SESSION") >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT

export AIDD_USER_CONFIG_DIR="$TMP/aidd-config"
export AIDD_SKIP_UPDATE_CHECK=1

FAIL=0
pass() { echo "  PASS  $1"; echo "        $2"; }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

echo "$(kiro-cli --version 2>&1 | head -1), $(date '+%Y-%m-%d %H:%M %Z')"

# A project with a memory bank and an empty memory block, so the hook has something to fill.
mkdir -p "$WS/aidd_docs/memory"
printf '# Architecture\n' >"$WS/aidd_docs/memory/architecture.md"
printf '# Project\n\n## Memory Management\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n' >"$WS/AGENTS.md"
git -C "$WS" init -q
git -C "$WS" -c user.email=smoke@aidd -c user.name=smoke commit -q --allow-empty -m init

if ! (cd "$WS" && node "$CLI" setup --source local --path "$FRAMEWORK" --ide kiro --plugins recommended --yes) >"$TMP/setup.log" 2>&1; then
  echo "FATAL: aidd setup failed"; tail -5 "$TMP/setup.log"; exit 1
fi
for f in ".kiro/skills/$SKILL/SKILL.md" ".kiro/hooks/aidd.json" ".kiro/agents/$AGENT.json"; do
  [[ -f "$WS/$f" ]] || { echo "FATAL: setup did not write $f"; exit 1; }
done

# One headless turn, bounded: the 2.x engine ignores `.kiro/hooks/`, hence `--v3`.
EVENTS="$TMP/turn.jsonl"
(cd "$WS" && exec kiro-cli chat --v3 --no-interactive --trust-workspace --trust-all-tools \
  --agent "$AGENT" --output-format stream-json "Reply with the single word OK.") >"$EVENTS" 2>"$TMP/turn.err" &
TURN_PID=$!
for ((i = 0; i < TURN_SECONDS; i++)); do
  kill -0 "$TURN_PID" 2>/dev/null || break
  sleep 1
done
kill "$TURN_PID" 2>/dev/null
wait "$TURN_PID" 2>/dev/null
TURN_PID=""

# From the turn's events: its session, how it ended, the agent it ran under, and the commands
# Kiro offered, one per line in $TMP/commands.txt. Skills and agents are both offered as commands.
read -r SESSION STATUS MODE < <(node -e '
  const [file, out] = process.argv.slice(1);
  const events = require("fs").readFileSync(file, "utf8").split("\n")
    .filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
  const updates = events.map((event) => event.data?.update).filter(Boolean);
  const commands = updates.filter((update) => update.sessionUpdate === "available_commands_update")
    .at(-1)?.availableCommands ?? [];
  const mode = updates.flatMap((update) => update.configOptions ?? [])
    .filter((option) => option.id === "mode").at(-1)?.currentValue;
  const done = events.find((event) => event.type === "runFinished")?.data ?? {};
  require("fs").writeFileSync(out, commands.map((command) => command.name).join("\n") + "\n");
  console.log(done.sessionId || "-", done.status || "-", mode || "-");
' "$EVENTS" "$TMP/commands.txt" 2>/dev/null)
[[ "$SESSION" == "-" ]] && SESSION=""

if [[ "${STATUS:-}" != "success" ]]; then
  echo "FATAL: the Kiro turn did not finish (status: ${STATUS:-none}, bound ${TURN_SECONDS}s)"
  grep -v '^\[INFO\]' "$TMP/turn.err" | tail -5
  exit 1
fi

installed="$(cd "$WS/.kiro/skills" && ls -d aidd-* | sort)"
offered="$(sort "$TMP/commands.txt")"
missing="$(comm -23 <(echo "$installed") <(echo "$offered") | tr '\n' ' ')"
count="$(echo "$installed" | wc -l | tr -d ' ')"
if [[ -z "$missing" ]] && grep -qx "$SKILL" "$TMP/commands.txt" && ! grep -qx "$GHOST" "$TMP/commands.txt"; then
  pass "skills offered" "all $count installed skills are among Kiro's commands, $SKILL included, $GHOST absent"
else
  fail "skills: Kiro does not offer every installed skill (missing: ${missing:-none}) or offers the invented $GHOST"
fi

if [[ "$MODE" == "$AGENT" ]] && ! grep -qi "needs upgrading" "$EVENTS" "$TMP/turn.err"; then
  pass "agent loaded" "the turn ran under $AGENT, with no 'needs upgrading' fallback"
else
  fail "agent: the turn ran under '${MODE}', not $AGENT, or Kiro asked to upgrade the profile"
fi

lines="$(grep -c 'aidd_docs/memory/architecture.md' "$WS/AGENTS.md")"
if [[ "$lines" == "1" ]]; then
  pass "memory refreshed once" "AGENTS.md: $(grep -m1 'aidd_docs/memory/architecture.md' "$WS/AGENTS.md")"
else
  fail "memory: AGENTS.md holds $lines link(s) to the memory bank, the SessionStart hook should write exactly one"
fi

echo
[[ "$FAIL" -eq 0 ]] && { echo "smoke-kiro: all passed"; exit 0; }
echo "smoke-kiro: $FAIL failed"; exit 1
