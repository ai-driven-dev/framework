#!/usr/bin/env bash
# Runtime smoke against a real, logged-in `kiro-cli` (V3 engine): after `aidd setup --ide kiro`, a
# non-interactive turn on a cheap model lists an AIDD skill and runs an AIDD hook from the project.
# Opt-in, never in CI or lefthook: a turn needs a Kiro login. `AIDD_SMOKE_KIRO=1 pnpm smoke:kiro`.
# HOME stays real for the login; `AIDD_USER_CONFIG_DIR` is relocated so setup never touches the
# real aidd profile. The chat the turn creates is deleted on exit.
set -uo pipefail

[[ "${AIDD_SMOKE_KIRO:-}" == "1" ]] || { echo "smoke-kiro: skipped, set AIDD_SMOKE_KIRO=1 to run it"; exit 0; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMEWORK="$(cd "$ROOT/.." && pwd)"
CLI="$ROOT/dist/cli.js"
KIRO_VERSION="3.6.0"
MODEL="qwen3-coder-next"
TURN_SECONDS="${SMOKE_KIRO_TIMEOUT:-150}"
SKILL="aidd-context-00-onboard"

source "$ROOT/scripts/smoke-host.sh"

command -v kiro-cli >/dev/null 2>&1 || { echo "FATAL: kiro-cli not on PATH, install kiro-cli $KIRO_VERSION and log in"; exit 1; }
[[ -f "$CLI" ]] || { echo "FATAL: $CLI missing, run 'pnpm build' first"; exit 1; }
kiro-cli whoami >/dev/null 2>&1 || { echo "FATAL: kiro-cli is not logged in, run 'kiro-cli login' once"; exit 1; }

TMP="$(mktemp -d)"
WS="$TMP/project"
SESSION_ID=""
cleanup() {
  [[ -n "$SESSION_ID" ]] && (cd "$WS" && kiro-cli chat --delete-session "$SESSION_ID" >/dev/null 2>&1)
  rm -rf "${TMP:?}"
}
trap cleanup EXIT

export AIDD_USER_CONFIG_DIR="$TMP/aidd-config"
export AIDD_SKIP_UPDATE_CHECK=1

installed="$(kiro-cli --version 2>&1 | head -1)"
echo "kiro-cli $installed"
[[ "$installed" == *"$KIRO_VERSION"* ]] || echo "WARN: probed on kiro-cli $KIRO_VERSION, results on this version are unverified"

smoke_setup --ide kiro ".kiro/skills/$SKILL/SKILL.md" ".kiro/hooks/aidd.json"

STREAM="$TMP/stream.jsonl"
(cd "$WS" && perl -e 'alarm shift; exec @ARGV' -- "$TURN_SECONDS" kiro-cli chat --v3 --no-interactive --trust-workspace \
  --model "$MODEL" --output-format stream-json "Reply with the single word OK." </dev/null) >"$STREAM" 2>"$TMP/kiro.err"

# V3 stream-json is an ACP payload: skills arrive as `available_commands_update` entries typed `skill` in `_meta.kiro`.
facts="$(node -e '
const events = require("node:fs").readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
const updates = events.map((event) => event.data?.update).filter(Boolean);
const finished = events.find((event) => event.type === "runFinished");
const sessionId = events.find((event) => event.data?.sessionId)?.data.sessionId;
if (sessionId) console.log(`session=${sessionId}`);
if (finished) console.log(`status=${finished.data.status}`);
const commands = updates.filter((update) => update.availableCommands).flatMap((update) => update.availableCommands);
const skill = commands.find((command) => command.name === process.argv[2] && command._meta?.kiro?.type === "skill");
if (skill) console.log(`skill=${skill.name}`);
const hook = updates.map((update) => update._meta?.kiro?.hook).find((entry) => entry?.status === "completed" && entry.hookId?.includes(".kiro/hooks/aidd.json"));
if (hook) console.log(`hook=${hook.name}`);
' "$STREAM" "$SKILL")"
fact() { grep -m1 "^$1=" <<<"$facts" | cut -d= -f2-; }

SESSION_ID="$(fact session)"
[[ "$(fact status)" == "success" ]] && pass "turn completed" "kiro-cli $MODEL, status success" || { fail "turn did not finish with success"; tail -3 "$TMP/kiro.err"; }
line="$(fact skill)"
[[ -n "$line" ]] && pass "skill listed" "available command of type skill: $line" || fail "skill: $SKILL is not an available skill command"
line="$(fact hook)"
[[ -n "$line" ]] && pass "hook ran" "completed from .kiro/hooks/aidd.json: $line" || fail "hook: no completed hook event from .kiro/hooks/aidd.json"
smoke_assert_memory

smoke_finish smoke-kiro
