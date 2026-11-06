#!/usr/bin/env bash
set -euo pipefail

# Check isolated AIDD setup, version selection, and plugin reporting without a network call.
root=$(cd "$(dirname "$0")/../../.." && pwd -P)
work=$(mktemp -d "${TMPDIR:-/tmp}/aidd-setup-test.XXXXXXXX")
cleanup() { if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi; }
trap cleanup EXIT
mkdir -p "$work/bin" "$work/project/.aidd" "$work/target"
export NPX_LOG="$work/npx.log" PATH="$work/bin:$PATH"
export AIDD_TOKEN='test-secret-not-for-logs' NPX_TEST_TOKEN='test-secret-not-for-logs'
cat > "$work/bin/npx" <<'NPX'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" >> "$NPX_LOG"
printf 'CLI output contains %s\n' "$NPX_TEST_TOKEN"
if [[ $3 == setup ]]; then
  mkdir -p .aidd/plugin-cache/dev/plugins/aidd-dev/skills/05-review .aidd/plugin-cache/dev/.git
  printf 'secret=%s\n' "$NPX_TEST_TOKEN" > .aidd/plugin-cache/dev/.git/config
  printf '# Review\n' > .aidd/plugin-cache/dev/plugins/aidd-dev/skills/05-review/SKILL.md
  printf '%s\n' '{"tools":{"opencode":{"plugins":[{"name":"aidd-dev","version":"2.2.0"}]}}}' > .aidd/manifest.json
  [[ ${NPX_FAIL_SETUP:-0} != 1 ]] || exit 23
elif [[ $3 == translate ]]; then
  source=$4
  if grep -rqF "$NPX_TEST_TOKEN" "$(dirname "$source")/setup"; then
    echo 'Setup cache still contains a credential during translation' >&2; exit 1
  fi
  jq -e '.plugins | map(.name) == ["aidd-dev"]' "$source/.claude-plugin/marketplace.json" >/dev/null
  for ((i=1; i<=$#; i++)); do
    if [[ ${!i} == --out ]]; then ((i+=1)); out=${!i}; break; fi
  done
  mkdir -p "$out/.opencode/skills/aidd-dev/05-review" "$out/.opencode/agents"
  if [[ ${NPX_OMIT_SKILLS:-0} != 1 ]]; then
    cp "$source/plugins/aidd-dev/skills/05-review/SKILL.md" "$out/.opencode/skills/aidd-dev/05-review/SKILL.md"
  fi
  printf '# Agent\n' > "$out/.opencode/agents/aidd-dev-agent.md"
else
  exit 2
fi
NPX
chmod +x "$work/bin/npx"

cat > "$work/project/.aidd/manifest.json" <<'JSON'
{"version":8,"tools":{"opencode":{"version":"5.6.0","plugins":[{"name":"aidd-dev","marketplace":"aidd-framework","version":"2.1.0","source":{"kind":"git-subdir","url":"https://github.com/ai-driven-dev/framework.git","path":"plugins/aidd-dev"}},{"name":"outside","marketplace":"other","version":"1.0.0","source":{"kind":"local","path":"./untrusted"}}]}}}
JSON
cp "$work/project/.aidd/manifest.json" "$work/original.json"
"$root/scripts/pr-review/setup-project.sh" "$work/project" "$work/target" > "$work/out" 2>&1
grep -Fxq '@ai-driven-dev/cli@5.6.0' "$NPX_LOG"
grep -Fxq 'aidd-dev' "$NPX_LOG"
if grep -Fxq 'outside' "$NPX_LOG"; then echo 'Unsupported plugin was installed' >&2; exit 1; fi
grep -q 'outside' "$work/out"
grep -q '2.1.0.*2.2.0' "$work/out"
if grep -Fq "$NPX_TEST_TOKEN" "$work/out"; then echo 'Credential appeared in output' >&2; exit 1; fi
grep -Fq '[REDACTED]' "$work/out"
[[ -f $work/target/.opencode/skills/aidd-dev/05-review/SKILL.md ]]
[[ -f $work/target/.opencode/agents/aidd-dev-agent.md ]]
[[ ! -e $work/target/.aidd ]]
cmp -s "$work/original.json" "$work/project/.aidd/manifest.json"

mkdir "$work/no-manifest" "$work/target-latest"
"$root/scripts/pr-review/setup-project.sh" "$work/no-manifest" "$work/target-latest" > "$work/out" 2>&1
grep -Fxq '@ai-driven-dev/cli@latest' "$NPX_LOG"
grep -Fxq 'none' "$NPX_LOG"
grep -qi 'inventory' "$work/out"

cat > "$work/project/.aidd/manifest.json" <<'JSON'
{"version":8,"tools":{"claude":{"version":"5.6.0","plugins":[{"name":"aidd-dev","marketplace":"aidd-framework","version":"2.2.0"}]},"cursor":{"version":"5.6.0"}}}
JSON
mkdir "$work/target-other-tool"
"$root/scripts/pr-review/setup-project.sh" "$work/project" "$work/target-other-tool" > "$work/out" 2>&1
grep -Fxq '@ai-driven-dev/cli@5.6.0' "$NPX_LOG"
grep -Fxq 'aidd-dev' "$NPX_LOG"
grep -qi 'OpenCode plugin inventory unavailable' "$work/out"

mkdir "$work/target-missing-skills"
if NPX_OMIT_SKILLS=1 "$root/scripts/pr-review/setup-project.sh" "$work/project" "$work/target-missing-skills" > "$work/out" 2>&1; then
  echo 'Missing translated skills were accepted' >&2; exit 1
fi
if grep -Fq "$NPX_TEST_TOKEN" "$work/out"; then echo 'Credential appeared in output' >&2; exit 1; fi

mkdir "$work/target-setup-failure"
if NPX_FAIL_SETUP=1 "$root/scripts/pr-review/setup-project.sh" "$work/project" "$work/target-setup-failure" > "$work/out" 2>&1; then
  echo 'Failed CLI setup was accepted' >&2; exit 1
fi
if grep -Fq "$NPX_TEST_TOKEN" "$work/out"; then echo 'Credential appeared in failure output' >&2; exit 1; fi
grep -Fq '[REDACTED]' "$work/out"

cat > "$work/project/.aidd/manifest.json" <<'JSON'
{"version":8,"tools":{"claude":{"version":"5.6.0"},"cursor":{"version":"5.7.0"}}}
JSON
rm "$NPX_LOG"
mkdir "$work/target-ambiguous"
if "$root/scripts/pr-review/setup-project.sh" "$work/project" "$work/target-ambiguous" > "$work/out" 2>&1; then
  echo 'Ambiguous version was accepted' >&2; exit 1
fi
[[ ! -e $NPX_LOG ]]
grep -qi 'version' "$work/out"

cat > "$work/project/.aidd/manifest.json" <<'JSON'
{"version":8,"tools":{"opencode":{"version":"5.6.0","plugins":[{"name":"not valid","marketplace":"aidd-framework","version":"1.0.0"}]}}}
JSON
mkdir "$work/target-invalid"
if "$root/scripts/pr-review/setup-project.sh" "$work/project" "$work/target-invalid" > "$work/out" 2>&1; then
  echo 'Invalid plugin name was accepted' >&2; exit 1
fi
[[ ! -e $NPX_LOG ]]

echo 'Project setup checks passed'
