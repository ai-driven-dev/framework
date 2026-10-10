#!/usr/bin/env bash
set -u

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
attempt_name="${1:-attempt-latest}"
result_dir="$script_dir/$attempt_name"
mkdir -p "$result_dir"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel)"
project_source="$script_dir/generated-project"
runtime_root="$(mktemp -d /tmp/aidd-914-phase-4-runtime.XXXXXX)"
xdg_root="$(mktemp -d /tmp/aidd-914-phase-4-xdg.XXXXXX)"
mkdir -p "$xdg_root/config" "$xdg_root/data" "$xdg_root/state" "$xdg_root/cache"

cleanup() {
  rm -rf -- "$runtime_root" "$xdg_root"
}
trap cleanup EXIT

export XDG_CONFIG_HOME="$xdg_root/config"
export XDG_DATA_HOME="$xdg_root/data"
export XDG_STATE_HOME="$xdg_root/state"
export XDG_CACHE_HOME="$xdg_root/cache"

cp -R "$project_source/." "$runtime_root/"
cd "$runtime_root" || exit 90

kilo --version > "$result_dir/kilo-version.txt" 2> "$result_dir/kilo-version.stderr.txt"
  printf '%s\n' "$?" > "$result_dir/kilo-version.exit.txt"
(
  cd "$repo_root" || exit 91
  sha256sum \
    plugins/aidd-context/skills/06-agent-generate/SKILL.md \
    plugins/aidd-context/skills/06-agent-generate/actions/01-capture-agent.md \
    plugins/aidd-context/skills/06-agent-generate/actions/02-write-agent.md \
    plugins/aidd-context/skills/06-agent-generate/actions/03-validate.md \
    plugins/aidd-context/skills/06-agent-generate/references/tool-paths.md \
    plugins/aidd-context/skills/06-agent-generate/references/agent-authoring.md \
    plugins/aidd-context/skills/06-agent-generate/assets/agent-template.md \
    plugins/aidd-context/skills/07-command-generate/SKILL.md \
    plugins/aidd-context/skills/07-command-generate/actions/01-capture-command.md \
    plugins/aidd-context/skills/07-command-generate/actions/02-write-command.md \
    plugins/aidd-context/skills/07-command-generate/actions/03-validate.md \
    plugins/aidd-context/skills/07-command-generate/references/tool-paths.md \
    plugins/aidd-context/skills/07-command-generate/references/command-authoring.md \
    plugins/aidd-context/skills/07-command-generate/assets/command-template.md
) > "$result_dir/source-contract-hashes.txt"
(
  cd "$project_source" || exit 92
  sha256sum .kilo/agents/verify-agent.md .kilo/agents/assets/agent-payload.txt .kilo/commands/verify-workflow.md
) > "$result_dir/generated-artifact-hashes.txt"
sha256sum .kilo/agents/verify-agent.md .kilo/agents/assets/agent-payload.txt .kilo/commands/verify-workflow.md > "$result_dir/artifact-hashes-consumed-before.txt"

kilo models kilo --verbose --pure > "$runtime_root/model-catalog.raw.txt" 2> "$runtime_root/model-catalog.raw.stderr.txt"
printf '%s\n' "$?" > "$result_dir/model-catalog.exit.txt"
sed "s|$runtime_root|\$RUNTIME_PROJECT|g; s|$xdg_root|\$XDG_ROOT|g; s|/home/coder|\$USER_HOME|g" "$runtime_root/model-catalog.raw.stderr.txt" > "$result_dir/model-catalog.stderr.txt"
node "$script_dir/extract-free-model.cjs" "$runtime_root/model-catalog.raw.txt" "$result_dir/selected-free-model.stdout.txt"

kilo debug agent verify-agent --pure --print-logs > "$runtime_root/agent-debug.raw.json" 2> "$runtime_root/agent-debug.raw.stderr.txt"
printf '%s\n' "$?" > "$result_dir/agent-debug.exit.txt"
node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const scrub=(x)=>{if(typeof x==="string")return x.replaceAll(process.argv[3],"$RUNTIME_PROJECT").replaceAll(process.argv[4],"$XDG_ROOT").replaceAll("/home/coder","$USER_HOME"); if(Array.isArray(x))return x.map(scrub); if(x&&typeof x==="object")return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,scrub(v)])); return x;}; fs.writeFileSync(process.argv[2],JSON.stringify(scrub(value),null,2)+"\n");' "$runtime_root/agent-debug.raw.json" "$result_dir/agent-debug.stdout.json" "$runtime_root" "$xdg_root"
sed -E "s|$runtime_root|\$RUNTIME_PROJECT|g; s|$xdg_root|\$XDG_ROOT|g; s|/home/coder|\$USER_HOME|g; s/run_id=[0-9a-fA-F-]+/run_id=[redacted]/g; s/ses_[A-Za-z0-9]+/[redacted-session]/g" "$runtime_root/agent-debug.raw.stderr.txt" > "$result_dir/agent-debug.stderr.txt"

kilo run --pure --command verify-workflow --model kilo/cohere/north-mini-code:free --format json \
  'Run verify-workflow. Return only the exact payload obtained by its subagent. Do not modify files.' \
  > "$runtime_root/workflow-run.raw.jsonl" 2> "$runtime_root/workflow-run.raw.stderr.txt"
run_status=$?
printf '%s\n' "$run_status" > "$result_dir/workflow-run.exit.txt"

if [ "$run_status" -eq 0 ]; then
  session_ids="$(node -e 'const fs=require("node:fs"); const lines=fs.readFileSync(process.argv[1],"utf8").trim().split(/\n/u); const events=lines.map(JSON.parse); const main=events.find((e)=>e.sessionID)?.sessionID; const task=events.find((e)=>e.type==="tool_use"&&e.part?.tool==="task"&&e.part?.state?.status==="completed"); const child=task?.part?.state?.metadata?.sessionId; if(main) console.log(main); if(child) console.log(child);' "$runtime_root/workflow-run.raw.jsonl")"
  main_session="$(printf '%s\n' "$session_ids" | sed -n '1p')"
  child_session="$(printf '%s\n' "$session_ids" | sed -n '2p')"
  if [ -n "$main_session" ]; then
    kilo export --sanitize "$main_session" > "$runtime_root/main-session.raw.json" 2> "$runtime_root/main-session.raw.stderr.txt"
    printf '%s\n' "$?" > "$result_dir/main-session-export.exit.txt"
    node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const scrub=(x)=>{if(typeof x==="string")return x.replace(/(?:prt|msg|ses)_[A-Za-z0-9]+/gu,"[redacted-id]").replaceAll(process.argv[3],"$RUNTIME_PROJECT").replaceAll(process.argv[4],"$XDG_ROOT").replaceAll("/home/coder","$USER_HOME"); if(Array.isArray(x))return x.map(scrub); if(x&&typeof x==="object")return Object.fromEntries(Object.entries(x).filter(([k])=>!/(^id$|id$|sessionid|callid)/iu.test(k)).map(([k,v])=>[k,scrub(v)])); return x;}; fs.writeFileSync(process.argv[2],JSON.stringify(scrub(value),null,2)+"\n");' "$runtime_root/main-session.raw.json" "$result_dir/main-session.sanitized.json" "$runtime_root" "$xdg_root"
    sed -E "s|$runtime_root|\$RUNTIME_PROJECT|g; s|$xdg_root|\$XDG_ROOT|g; s|/home/coder|\$USER_HOME|g; s/ses_[A-Za-z0-9]+/[redacted-session]/g" "$runtime_root/main-session.raw.stderr.txt" > "$result_dir/main-session-export.stderr.txt"
  fi
  if [ -n "$child_session" ]; then
    kilo export --sanitize "$child_session" > "$runtime_root/subagent-session.raw.json" 2> "$runtime_root/subagent-session.raw.stderr.txt"
    printf '%s\n' "$?" > "$result_dir/subagent-session-export.exit.txt"
    node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const scrub=(x)=>{if(typeof x==="string")return x.replace(/(?:prt|msg|ses)_[A-Za-z0-9]+/gu,"[redacted-id]").replaceAll(process.argv[3],"$RUNTIME_PROJECT").replaceAll(process.argv[4],"$XDG_ROOT").replaceAll("/home/coder","$USER_HOME"); if(Array.isArray(x))return x.map(scrub); if(x&&typeof x==="object")return Object.fromEntries(Object.entries(x).filter(([k])=>!/(^id$|id$|sessionid|callid)/iu.test(k)).map(([k,v])=>[k,scrub(v)])); return x;}; fs.writeFileSync(process.argv[2],JSON.stringify(scrub(value),null,2)+"\n");' "$runtime_root/subagent-session.raw.json" "$result_dir/subagent-session.sanitized.json" "$runtime_root" "$xdg_root"
    sed -E "s|$runtime_root|\$RUNTIME_PROJECT|g; s|$xdg_root|\$XDG_ROOT|g; s|/home/coder|\$USER_HOME|g; s/ses_[A-Za-z0-9]+/[redacted-session]/g" "$runtime_root/subagent-session.raw.stderr.txt" > "$result_dir/subagent-session-export.stderr.txt"
  fi
fi

node -e 'const fs=require("node:fs"); const raw=fs.readFileSync(process.argv[1],"utf8"); const scrub=(x)=>{if(typeof x==="string")return x.replace(/(<task id=")[^"]+("[^>]*>)/gu,"$1[redacted]$2").replace(/ses_[A-Za-z0-9]+/gu,"[redacted-session]").replaceAll(process.argv[3],"$RUNTIME_PROJECT").replaceAll(process.argv[4],"$XDG_ROOT").replaceAll("/home/coder","$USER_HOME"); if(Array.isArray(x))return x.map(scrub); if(x&&typeof x==="object")return Object.fromEntries(Object.entries(x).filter(([k])=>!/(^id$|id$|sessionid|callid|reasoning)/iu.test(k)).map(([k,v])=>[k,scrub(v)])); return x;}; const out=raw.split(/\n/u).filter(Boolean).map((line)=>JSON.stringify(scrub(JSON.parse(line)))).join("\n")+"\n"; fs.writeFileSync(process.argv[2],out);' "$runtime_root/workflow-run.raw.jsonl" "$result_dir/workflow-run.redacted.jsonl" "$runtime_root" "$xdg_root"
sed -E "s|$runtime_root|\$RUNTIME_PROJECT|g; s|$xdg_root|\$XDG_ROOT|g; s|/home/coder|\$USER_HOME|g; s/ses_[A-Za-z0-9]+/[redacted-session]/g; s/run_id=[0-9a-fA-F-]+/run_id=[redacted]/g" "$runtime_root/workflow-run.raw.stderr.txt" > "$result_dir/workflow-run.stderr.txt"

sha256sum .kilo/agents/verify-agent.md .kilo/agents/assets/agent-payload.txt .kilo/commands/verify-workflow.md > "$result_dir/artifact-hashes-consumed-after.txt"
printf 'runtime_exit=%s\n' "$run_status"
printf 'runtime_project=/tmp isolated; cleaned_on_exit=true\n'
exit "$run_status"
