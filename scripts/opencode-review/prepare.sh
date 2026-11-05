#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$RUNNER_TEMP/opencode-review/.opencode/skills"
for part in SKILL.md actions/01-prepare.md actions/02-review.md actions/03-conclude.md \
  references/rubric.md references/axis-code.md references/axis-functional.md \
  references/axis-relevancy.md assets/review-template.md; do
  test -s "trusted/plugins/aidd-dev/skills/05-review/$part" || {
    echo "::error::Trusted review skill is missing $part"; exit 1;
  }
done
# The PR is data: do not load its agent configuration, instructions, plugins or links.
git -C head archive HEAD | tar -x -f - -C "$RUNNER_TEMP/opencode-review" \
  --exclude='.opencode' --exclude='*/.opencode' \
  --exclude='.agents' --exclude='*/.agents' \
  --exclude='.claude' --exclude='*/.claude' \
  --exclude='.review-input' --exclude='*/.review-input' \
  --exclude='opencode.json' --exclude='*/opencode.json' \
  --exclude='opencode.jsonc' --exclude='*/opencode.jsonc' \
  --exclude='AGENTS.md' --exclude='*/AGENTS.md' \
  --exclude='CLAUDE.md' --exclude='*/CLAUDE.md'
find "$RUNNER_TEMP/opencode-review" -type l -delete
cp -R trusted/plugins/aidd-dev/skills/05-review "$RUNNER_TEMP/opencode-review/.opencode/skills/05-review"
mkdir -p "$RUNNER_TEMP/opencode-review/.review-input"
cp "$RUNNER_TEMP/opencode-review-input/"*.md "$RUNNER_TEMP/opencode-review/.review-input/"
sudo mkdir -p /etc/opencode
sudo cp "$GITHUB_WORKSPACE/trusted/scripts/opencode-review/policy.json" /etc/opencode/opencode.json
