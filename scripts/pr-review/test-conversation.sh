#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd -P)
mkdir -p "$root/.tmp"
work=$(mktemp -d "$root/.tmp/pr-conversation-test.XXXXXXXX")
cleanup() { if [[ $(uname -s) == Darwin ]]; then trash "$work"; else rm -rf -- "$work"; fi; }
trap cleanup EXIT
mkdir -p "$work/bin" "$work/run" "$work/project"

# Execute the actual workflow steps, replacing only the external commands.
for step in 'Write the prompt' 'Run OpenCode' 'Push the changes and reply'; do
  case "$step" in
    'Write the prompt') output=prompt ;;
    'Run OpenCode') output=model ;;
    *) output=reply ;;
  esac
  awk -v step="$step" '
    $0 == "      - name: " step {found=1; next}
    found && /^        run: \|$/ {reading=1; next}
    reading && /^          / {sub(/^          /, ""); print; next}
    reading && /^$/ {print; next}
    reading {exit}
  ' "$root/.github/workflows/opencode.yml" > "$work/$output.sh"
  [[ -s $work/$output.sh ]] || { echo "Missing workflow step: $step" >&2; exit 1; }
done

cat > "$work/bin/gh" <<'GH'
#!/usr/bin/env bash
set -euo pipefail
if [[ ${TEST_FAIL_API:-} == 1 && $* == *'issues/1150/comments?per_page=100'* ]]; then exit 22; fi
case "$*" in
  *'issues/1150/comments?per_page=100'*) cat "$TEST_DIR/issues.json" ;;
  *'pulls/1150/comments?per_page=100'*) cat "$TEST_DIR/thread.json" ;;
  *'comments/4/replies'*) cat > "$TEST_DIR/inline-reply.json" ;;
  'issue comment '*) cat > "$TEST_DIR/issue-reply.txt" ;;
  *) echo 'Unexpected GitHub call' >&2; exit 1 ;;
esac
GH
cat > "$work/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
[[ " $* " == *' -i '* ]] || { echo 'Docker stdin is not enabled' >&2; exit 1; }
[[ " $* " != *' -e GH_TOKEN '* && " $* " != *' -e GITHUB_TOKEN '* ]] || { echo 'GitHub token exposed to model' >&2; exit 1; }
cat > "$TEST_DIR/model-stdin"
printf 'A response\n'
DOCKER
chmod +x "$work/bin/gh" "$work/bin/docker"

python3 - "$work" <<'PY'
import base64, json, pathlib, sys
p = pathlib.Path(sys.argv[1])
emoji = '😀'
marker = base64.b64encode(json.dumps({'version': 1, 'review_id': '42', 'files': {}}).encode()).decode()
def save(name, value): (p / name).write_text(json.dumps(value), encoding='utf-8')
comments = [{'id': 100+i, 'body': emoji*3000, 'created_at': f'2026-01-01T00:{i:02d}:00Z', 'user': {'id': 8973343, 'login': 'alex', 'type': 'User'}} for i in range(25)]
comments.insert(0, {'id': 1, 'body': 'LATEST_BOT_REVIEW '+emoji*59960+' END_FULL_REVIEW\n<!-- aidd-review-v1:'+marker+' -->', 'created_at': '2025-12-31T23:59:59Z', 'user': {'id': 290648294, 'login': 'aidd-bot[bot]', 'type': 'Bot'}})
comments.append({'id': 3, 'body': 'INVALID_MARKER\n<!-- aidd-review-v1:YWJj -->', 'created_at': '2026-01-01T00:49:00Z', 'user': {'id': 290648294, 'login': 'aidd-bot[bot]', 'type': 'Bot'}})
comments.append({'id': 2, 'body': 'OTHER_BOT\n<!-- aidd-review-v1:'+marker+' -->', 'created_at': '2026-01-01T00:50:00Z', 'user': {'id': 7, 'login': 'other[bot]', 'type': 'Bot'}})
comments.append({'id': 6, 'body': '/opencode '+emoji*10000+' REQUEST_END', 'created_at': '2026-01-01T01:00:00Z', 'user': {'id': 8973343, 'login': 'alex', 'type': 'User'}})
save('issues.json', comments)
save('thread.json', [{'id': 4, 'body': 'Original inline finding', 'created_at': '2025-12-01T00:00:00Z', 'path': 'code.py', 'line': 3, 'user': {'login': 'reviewer', 'type': 'Bot'}}, {'id': 5, 'in_reply_to_id': 4, 'body': 'Prior reply', 'created_at': '2026-01-01T00:30:00Z', 'path': 'code.py', 'line': 3, 'user': {'login': 'alex', 'type': 'User'}}, {'id': 7, 'in_reply_to_id': 8, 'body': 'Unrelated thread', 'created_at': '2026-01-01T00:30:00Z', 'user': {'login': 'other', 'type': 'User'}}])
save('inline-event.json', {'pull_request': {'number': 1150, 'title': emoji*1000, 'body': emoji*10000}, 'comment': {'id': 6, 'in_reply_to_id': 4, 'path': 'code.py', 'line': 3, 'diff_hunk': emoji*8000, 'body': '/opencode '+emoji*10000+' REQUEST_END'}})
save('issue-event.json', {'issue': {'number': 1150, 'title': 'Example', 'body': 'PR body', 'pull_request': {}}, 'comment': {'id': 6, 'body': '/opencode respond'}})
PY

export TEST_DIR="$work" PATH="$work/bin:$PATH" REPO=example/repo NUMBER=1150 IS_PR=true RUNNER_TEMP="$work/run" GH_TOKEN=not-a-secret
export MODEL=test/model GITHUB_WORKSPACE="$work" GITHUB_EVENT_NAME=pull_request_review_comment GITHUB_EVENT_PATH="$work/inline-event.json"
bash "$work/prompt.sh"
python3 - "$work/run/prompt.md" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1]); text = p.read_text(); size = p.stat().st_size
assert 'Original inline finding' in text and 'Prior reply' in text
assert 'LATEST_BOT_REVIEW' in text and 'END_FULL_REVIEW' in text
assert 'Unrelated thread' not in text and 'aidd-review-v1' not in text
assert text.count('/opencode ') == 1 and text.endswith(' REQUEST_END\n')
assert 131072 < size <= 400000, size
PY
bash "$work/model.sh"
cmp "$work/run/prompt.md" "$work/model-stdin"

git -C "$work/project" init -q
export AGENT_OUTCOME=success APP_SLUG=example BRANCH=test RUN_URL=https://example.invalid
(cd "$work/project" && bash "$work/reply.sh")
jq -e '.body | contains("A response") and contains("No file changed.")' "$work/inline-reply.json" > /dev/null

export GITHUB_EVENT_NAME=issue_comment GITHUB_EVENT_PATH="$work/issue-event.json"
bash "$work/prompt.sh"
if grep -q 'Original inline finding' "$work/run/prompt.md"; then echo 'Unexpected inline thread' >&2; exit 1; fi
(cd "$work/project" && bash "$work/reply.sh")
grep -q 'A response' "$work/issue-reply.txt"
if TEST_FAIL_API=1 bash "$work/prompt.sh" >/dev/null 2>&1; then echo 'Expected API failure' >&2; exit 1; fi

python3 - "$work/issue-event.json" <<'PY'
import json, pathlib, sys
p = pathlib.Path(sys.argv[1]); event = json.loads(p.read_text())
event['comment']['body'] = '/opencode ' + '😀'*100001 + ' REQUEST_END'
p.write_text(json.dumps(event), encoding='utf-8')
PY
if bash "$work/prompt.sh" >/dev/null 2>&1; then echo 'Expected oversized prompt to fail' >&2; exit 1; fi
export AGENT_OUTCOME=failure
(cd "$work/project" && bash "$work/reply.sh")
grep -q 'exceed 400,000 bytes' "$work/issue-reply.txt"
printf 'Conversation prompt and reply scenarios passed\n'
