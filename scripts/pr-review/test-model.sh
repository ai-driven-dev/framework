#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd -P)
mkdir -p "$root/.tmp"
work=$(mktemp -d "$root/.tmp/model-test.XXXXXXXX")
cleanup() { chmod -R u+w "$work"; if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi; }
trap cleanup EXIT
mkdir -p "$work/input/source" "$work/input/review-input" "$work/bin" "$work/skill/actions"
# model_main accepts explicit policy/prompt arguments only when sourced. Its real
# entry point always fixes them to the trusted container locations.
source "$root/scripts/pr-review/model.sh"
cp "$root"/plugins/aidd-dev/skills/05-review/actions/{01-prepare,02-review,03-conclude}.md "$work/skill/actions/"
run_model() { model_main "$@" "$work/skill"; }
export FAKE_EVENTS="$work/events.json" FAKE_CHILD="$work/child.json" FAKE_CALLS="$work/calls"
export PATH="$work/bin:$PATH"

cat > "$work/bin/opencode" <<'OPENCODE'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$FAKE_CALLS"
[[ -z ${GH_TOKEN:-} && -z ${GITHUB_TOKEN:-} ]] || exit 1
if [[ $1 == --standalone && $2 == run ]]; then cat "$FAKE_EVENTS"
elif [[ $1 == --standalone && $2 == session && $3 == export ]]; then cat "$FAKE_CHILD"
else exit 1
fi
OPENCODE
chmod +x "$work/bin/opencode"

jq -n --arg allowed "external_directory:$work/skill/*" '{policies: ((["shell:*","edit:*","execute:*","webfetch:*","websearch:*","question:*","external_directory:*"] | map({action:"tool.use",resource:.,effect:"deny"})) + [{action:"tool.use",resource:$allowed,effect:"allow"},{action:"mcp.use",resource:"*",effect:"deny"},{action:"plugin.use",resource:"*",effect:"deny"}])}' > "$work/policy.json"
printf 'Review prompt.\n' > "$work/prompt.txt"
token=0123456789abcdef0123456789abcdef
printf 'AIDD_BEGIN_%s_1\n+first change\nAIDD_END_%s_1\n' "$token" "$token" > "$work/input/review-input/file-00001-001.txt"
printf 'AIDD_BEGIN_%s_1\n+second change\nAIDD_END_%s_1\n' "$token" "$token" > "$work/input/review-input/file-00002-001.txt"
printf 'AIDD_CONTEXT_BEGIN_%s\nTitle: Sample PR\n\nDescription:\nAcceptance criterion: preserve empty input.\nAIDD_CONTEXT_END_%s\n' "$token" "$token" > "$work/input/review-input/pr-context.txt"
jq -n --arg token "$token" '[{path:"a.txt",chunks:[{path:"review-input/file-00001-001.txt",begin:("AIDD_BEGIN_"+$token+"_1"),end:("AIDD_END_"+$token+"_1")}]},{path:"b.txt",chunks:[{path:"review-input/file-00002-001.txt",begin:("AIDD_BEGIN_"+$token+"_1"),end:("AIDD_END_"+$token+"_1")}]}]' > "$work/manifest.json"
# The read-only directory requirement is meaningful for the non-root user used
# in production; test it here without relying on the caller's checkout.
chmod a-w "$work/input" "$work/input/source" "$work/input/review-input"

jq -n '{type:"tool_use",sessionID:"ses_parent01",part:{tool:"subagent",state:{status:"completed",input:{agent:"aidd-orchestrator-reviewer",prompt:"Read review-input/pr-context.txt."},metadata:{metadata:{sessionID:"ses_child01"}}}}}' > "$FAKE_EVENTS"
cp "$FAKE_EVENTS" "$work/good-events.json"
jq -n --arg token "$token" --arg skill "$work/skill" --rawfile prepare "$work/skill/actions/01-prepare.md" --rawfile review "$work/skill/actions/02-review.md" --rawfile conclude "$work/skill/actions/03-conclude.md" '
  def read($path): {type:"tool",name:"read",state:{status:"completed",input:{path:$path},metadata:{truncated:false},content:[{type:"text",text:("AIDD_BEGIN_"+$token+"_1\nchange\nAIDD_END_"+$token+"_1")} ]}};
  def action($name; $text): {type:"tool",name:"read",state:{status:"completed",input:{path:($skill+"/actions/"+$name)},metadata:{truncated:false},content:[{type:"text",text:$text}]}};
  {info:{id:"ses_child01",parentID:"ses_parent01",agent:"aidd-orchestrator-reviewer",outcome:"succeeded",model:{providerID:"openai",id:"gpt-6.1-terra",variant:"medium"}},
   messages:[{type:"assistant",content:[{type:"tool",name:"skill",state:{status:"completed",input:{id:"05-review"}}},read("review-input/file-00001-001.txt"),read("review-input/file-00002-001.txt"),{type:"tool",name:"read",state:{status:"completed",input:{path:"review-input/pr-context.txt"},metadata:{truncated:false},content:[{type:"text",text:("AIDD_CONTEXT_BEGIN_"+$token+"\nAcceptance criterion: preserve empty input.\nAIDD_CONTEXT_END_"+$token)}]}},action("01-prepare.md";$prepare),action("02-review.md";$review),action("03-conclude.md";$conclude)]},
     {type:"assistant",content:[{type:"text",text:"A specific finding.\nAIDD_REVIEW_COVERAGE_V1: {\"reviewed\":[\"a.txt\",\"b.txt\"]}"}]}]}' > "$FAKE_CHILD"
cp "$FAKE_CHILD" "$work/good-child.json"
run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"
jq -e '.reviewed == ["a.txt","b.txt"] and .report == "A specific finding."' "$work/out.json" >/dev/null
grep -Fq 'without the source/ prefix' "$FAKE_CALLS"
grep -Fq 'Read review-input/pr-context.txt completely' "$FAKE_CALLS"

# The reviewer must read the complete PR context itself.
jq 'del(.messages[0].content[3])' "$work/good-child.json" > "$FAKE_CHILD"
if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'Missing PR context accepted' >&2; exit 1; fi
cp "$work/good-child.json" "$FAKE_CHILD"

# A loaded skill is insufficient if any required action is missing or partial.
for index in 4 5 6; do
  jq --argjson index "$index" 'del(.messages[0].content[$index])' "$work/good-child.json" > "$FAKE_CHILD"
  if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'Missing review action accepted' >&2; exit 1; fi
done
jq '.messages[0].content[5].state.metadata.truncated=true' "$work/good-child.json" > "$FAKE_CHILD"
if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'Truncated review action accepted' >&2; exit 1; fi
cp "$work/good-child.json" "$FAKE_CHILD"

# Claimed coverage is not trusted if the read is missing or was truncated.
jq 'del(.messages[0].content[2])' "$work/good-child.json" > "$FAKE_CHILD"
run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"
jq -e '.reviewed == ["a.txt"] and (.report | contains("could not be verified"))' "$work/out.json" >/dev/null
jq '.messages[0].content[1].state.metadata.truncated=true' "$work/good-child.json" > "$FAKE_CHILD"
run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"
jq -e '.reviewed == ["b.txt"]' "$work/out.json" >/dev/null

# Missing skill, fake child identity, and unknown coverage fail closed.
jq 'del(.messages[0].content[0])' "$work/good-child.json" > "$FAKE_CHILD"
if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'Missing skill accepted' >&2; exit 1; fi
jq '.info.parentID="ses_other01"' "$work/good-child.json" > "$FAKE_CHILD"
if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'Wrong parent accepted' >&2; exit 1; fi
jq '.messages[1].content[0].text="Finding.\nAIDD_REVIEW_COVERAGE_V1: {\"reviewed\":[\"unknown\"]}"' "$work/good-child.json" > "$FAKE_CHILD"
if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'Unknown path accepted' >&2; exit 1; fi
cp "$work/good-child.json" "$FAKE_CHILD"

# Later policy exceptions must not reopen shell access.
jq '.policies += [{action:"tool.use",resource:"shell:cat *",effect:"allow"}]' "$work/policy.json" > "$work/unsafe-policy.json"
if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/unsafe-policy.json" "$work/prompt.txt"; then echo 'Unsafe policy accepted' >&2; exit 1; fi
if GH_TOKEN=leaked run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'GitHub token accepted' >&2; exit 1; fi

# OpenCode silently clips long individual lines, even in short files.
chmod u+w "$work/input/review-input/file-00001-001.txt"
{ printf 'AIDD_BEGIN_%s_1\n' "$token"; awk 'BEGIN {for(i=0;i<1801;i++) printf "x"; printf "\n"}'; printf 'AIDD_END_%s_1\n' "$token"; } > "$work/input/review-input/file-00001-001.txt"
if run_model "$work/input" "$work/manifest.json" "$work/out.json" "$work/policy.json" "$work/prompt.txt"; then echo 'Oversized line accepted' >&2; exit 1; fi
printf 'model trace validation scenarios passed\n'
