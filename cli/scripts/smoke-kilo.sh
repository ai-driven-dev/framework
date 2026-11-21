#!/usr/bin/env bash
# Runtime smoke against a real Kilo server (`@kilocode/cli`): after `aidd translate --to kilo --as flat`,
# the host discovers the generated skills, agents and MCP server, and runs the memory hook and a
# declared hook exactly once through a read-tool turn answered by a local fake model.
# Runs in CI (cli-kilo-runtime) and locally with `pnpm smoke:kilo`; needs `kilo` on PATH.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMEWORK="$(cd "$ROOT/.." && pwd)"
CLI="$ROOT/dist/cli.js"
KILO_VERSION="7.7.5"

command -v kilo >/dev/null 2>&1 || { echo "FATAL: kilo not on PATH, install @kilocode/cli@$KILO_VERSION"; exit 1; }
[[ -f "$CLI" ]] || { echo "FATAL: $CLI missing, run 'pnpm build' first"; exit 1; }

TMP="$(mktemp -d)"
HOME_DIR="$TMP/home"
GEN="$TMP/generated"
KILO_PID=""
MODEL_PID=""
cleanup() {
  [[ -n "$KILO_PID" ]] && { pkill -P "$KILO_PID" 2>/dev/null; kill "$KILO_PID" 2>/dev/null; }
  [[ -n "$MODEL_PID" ]] && kill "$MODEL_PID" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

FAIL=0
pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

mkdir -p "$HOME_DIR" "$GEN"
export HOME="$HOME_DIR" USERPROFILE="$HOME_DIR"
export XDG_CONFIG_HOME="$HOME_DIR/.config" XDG_CACHE_HOME="$HOME_DIR/.cache"
export XDG_DATA_HOME="$HOME_DIR/.local/share" XDG_STATE_HOME="$HOME_DIR/.local/state"
export KILO_SERVER_PASSWORD="" AIDD_SKIP_UPDATE_CHECK=1 AIDD_USER_CONFIG_DIR="$TMP/aidd-config"

# A local OpenAI-compatible model: first turn calls the read tool, the next one confirms.
cat >"$TMP/model.mjs" <<'JS'
import { createServer } from "node:http";
let readSent = false;
const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    if (request.url !== "/v1/chat/completions") return response.writeHead(404).end();
    const input = JSON.parse(body);
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (delta, finish = null) =>
      response.write(`data: ${JSON.stringify({ id: "chatcmpl-local", object: "chat.completion.chunk", created: 1, model: "fake", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
    chunk({ role: "assistant" });
    if (!readSent && input.tools?.some((tool) => tool.function.name === "read")) {
      readSent = true;
      chunk({ tool_calls: [{ index: 0, id: "call_local_read", type: "function", function: { name: "read", arguments: '{"filePath":"probe.txt"}' } }] });
      chunk({}, "tool_calls");
    } else {
      chunk({ content: "KILO_LOCAL_READ_CONFIRMED" });
      chunk({}, "stop");
    }
    response.end("data: [DONE]\n\n");
  });
});
server.listen(0, "127.0.0.1", () => console.log(`model listening on ${server.address().port}`));
JS
node "$TMP/model.mjs" >"$TMP/model.log" 2>&1 &
MODEL_PID=$!
for _ in $(seq 1 50); do grep -q "model listening" "$TMP/model.log" && break; sleep 0.1; done
MODEL_PORT="$(grep -Eo '[0-9]+$' "$TMP/model.log" | head -1)"
[[ -n "$MODEL_PORT" ]] || { echo "FATAL: local model did not start"; exit 1; }

printf '{"model":"openai-compatible/fake","instructions":["AGENTS.md"],"provider":{"openai-compatible":{"options":{"baseURL":"http://127.0.0.1:%s/v1"},"models":{"fake":{"name":"Local fake","tool_call":true,"limit":{"context":8192,"output":256}}}}}}' "$MODEL_PORT" >"$GEN/kilo.jsonc"
translate() { node "$CLI" translate "$1" --to kilo --as flat --out "$2" >"$TMP/translate.log" 2>&1 || { echo "FATAL: translate failed"; tail -5 "$TMP/translate.log"; exit 1; }; }

check "kilo is $KILO_VERSION" '[[ "$(kilo --version | tr -d "[:space:]")" == "$KILO_VERSION" ]]'

translate "$FRAMEWORK" "$GEN"
SKILLS_FOUND="$(cd "$GEN" && kilo debug skill | grep -c '\.kilo/skills/aidd-')"
SKILLS_WRITTEN="$(find "$GEN/.kilo/skills" -name SKILL.md | wc -l | tr -d ' ')"
check "every generated skill is discovered ($SKILLS_FOUND of $SKILLS_WRITTEN)" '[[ "$SKILLS_FOUND" -eq "$SKILLS_WRITTEN" && "$SKILLS_WRITTEN" -gt 0 ]]'
AGENTS_OUT="$(cd "$GEN" && kilo agent list)"
for role in explorer executor validator reviewer; do
  check "agent aidd-orchestrator-$role is listed" 'grep -q "aidd-orchestrator-$role" <<<"$AGENTS_OUT"'
done

MCP="$TMP/generated-mcp"
mkdir -p "$MCP"
translate "$ROOT/tests/fixtures/framework" "$MCP"
check "fixture agent is listed" '(cd "$MCP" && kilo agent list) | grep -q aidd-test-code-reviewer'
check "fixture MCP server is listed" '(cd "$MCP" && kilo mcp list) | grep -q aidd-test-aidd-test-server'

# A memory block to fill, and a plugin whose hooks record every payload they receive.
mkdir -p "$GEN/aidd_docs/memory"
printf 'Kilo memory\n' >"$GEN/aidd_docs/memory/runtime.md"
printf '# Runtime\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n' >"$GEN/AGENTS.md"
printf 'KILO_LOCAL_READ_OK\n' >"$GEN/probe.txt"
check "memory hook script is the shipped one" 'cmp -s "$GEN/.kilo/hooks/aidd-context/memory.cjs" "$FRAMEWORK/plugins/aidd-context/hooks/memory.cjs"'

PROOF="$TMP/proof-source"
mkdir -p "$PROOF/.claude-plugin" "$PROOF/plugins/runtime-proof/.claude-plugin" "$PROOF/plugins/runtime-proof/hooks"
printf '{"name":"runtime-proof","plugins":[{"name":"runtime-proof","source":"./plugins/runtime-proof"}]}' >"$PROOF/.claude-plugin/marketplace.json"
printf '{"name":"runtime-proof","version":"1.0.0"}' >"$PROOF/plugins/runtime-proof/.claude-plugin/plugin.json"
cat >"$PROOF/plugins/runtime-proof/hooks/capture.js" <<'JS'
import { appendFileSync } from "node:fs";
import { join } from "node:path";
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  appendFileSync(join(payload.cwd, "payloads.jsonl"), JSON.stringify(payload) + "\n");
  if (payload.hook_event_name === "PostToolUse") { process.stderr.write("KILO_HOOK_FEEDBACK\n"); process.exitCode = 2; }
});
JS
cat >"$PROOF/plugins/runtime-proof/hooks/hooks.json" <<'JSON'
{"hooks":{"SessionStart":[{"hooks":[{"command":"node ${CLAUDE_PLUGIN_ROOT}/hooks/capture.js"}]}],"PostToolUse":[{"matcher":"read","hooks":[{"command":"node ${CLAUDE_PLUGIN_ROOT}/hooks/capture.js"}]}],"Stop":[{"hooks":[{"command":"node ${CLAUDE_PLUGIN_ROOT}/hooks/capture.js"}]}]}}
JSON
translate "$PROOF" "$GEN"
cat >"$GEN/.kilo/plugin/observer.js" <<'JS'
import { appendFileSync } from "node:fs";
import { join } from "node:path";
export default { id: "runtime-observer", server: async ({ directory }) => ({ event: async ({ event }) => appendFileSync(join(directory, "events.jsonl"), JSON.stringify(event) + "\n") }) };
JS

check "the translated config keeps the model" '[[ "$(node -e "console.log(JSON.parse(require(\"fs\").readFileSync(process.argv[1],\"utf8\")).model)" "$GEN/kilo.jsonc")" == "openai-compatible/fake" ]]'
cp "$GEN/kilo.jsonc" "$TMP/delivered-kilo.jsonc"

(cd "$GEN" && kilo serve --hostname 127.0.0.1 --port 0) >"$TMP/kilo.log" 2>&1 &
KILO_PID=$!
for _ in $(seq 1 150); do grep -q "kilo server listening" "$TMP/kilo.log" && break; sleep 0.1; done
KILO_URL="http://127.0.0.1:$(grep -Eo 'kilo server listening on http://127.0.0.1:[0-9]+' "$TMP/kilo.log" | grep -Eo '[0-9]+$' | head -1)"
[[ "$KILO_URL" != "http://127.0.0.1:" ]] || { echo "FATAL: kilo did not start"; cat "$TMP/kilo.log"; exit 1; }

RUN_OUT="$(cd "$GEN" && kilo run --attach "$KILO_URL" --dir "$GEN" --format json --auto --model openai-compatible/fake 'Read probe.txt with the read tool.' 2>&1)"
check "the model turn completes" 'grep -q KILO_LOCAL_READ_CONFIRMED <<<"$RUN_OUT"'
for _ in $(seq 1 50); do
  [[ "$(wc -l <"$GEN/payloads.jsonl" 2>/dev/null | tr -d ' ')" == "3" ]] && grep -q 'aidd_docs/memory/runtime.md' "$GEN/AGENTS.md" && break
  sleep 0.1
done
check "the memory hook filled the memory block" 'grep -q "\[aidd_docs/memory/runtime.md\](aidd_docs/memory/runtime.md)" "$GEN/AGENTS.md"'
check "each declared hook ran exactly once (3 payloads)" '[[ "$(wc -l <"$GEN/payloads.jsonl" | tr -d " ")" == "3" ]]'
for event in SessionStart PostToolUse Stop; do
  check "$event fired once" '[[ "$(grep -c "\"hook_event_name\":\"$event\"" "$GEN/payloads.jsonl")" == "1" ]]'
done
check "the read tool completed once" '[[ "$(grep -c "\"status\":\"completed\"" "$GEN/events.jsonl")" -ge 1 ]]'
check "the hook feedback reached the model" 'grep -q "KILO_HOOK_FEEDBACK" "$TMP/kilo.log" "$GEN/events.jsonl"'
check "the delivered config is untouched" 'cmp -s "$TMP/delivered-kilo.jsonc" "$GEN/kilo.jsonc"'

echo
if [[ "$FAIL" -eq 0 ]]; then echo "kilo smoke: all passed"; else echo "kilo smoke: $FAIL failed"; exit 1; fi
