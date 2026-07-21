#!/usr/bin/env bash
set -e

# Usage: ./scripts/prerelease.sh [suffix]
# Default suffix: beta.1
# Example: ./scripts/prerelease.sh rc.1

SUFFIX="${1:-beta.1}"
CLI_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMEWORK_ROOT="$(cd "$CLI_ROOT/../framework" && pwd)"
CLI_BRANCH="feat/plugin-architecture"
FRAMEWORK_BRANCH="feat/plugin-architecture"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

step() { echo; echo "==> $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" &>/dev/null || die "'$1' not found"
}

require_cmd gh
require_cmd node
require_cmd pnpm
require_cmd npm
require_cmd zip

# ---------------------------------------------------------------------------
# Resolve versions
# ---------------------------------------------------------------------------

CLI_CURRENT="$(node -p "require('$CLI_ROOT/package.json').version")"
# Strip any existing pre suffix, extract major.minor.patch
BASE="$(echo "$CLI_CURRENT" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+')"
PRERELEASE_VERSION="${BASE}-${SUFFIX}"
TAG="v${PRERELEASE_VERSION}"

echo
echo "CLI root    : $CLI_ROOT"
echo "Framework   : $FRAMEWORK_ROOT"
echo "Version     : $PRERELEASE_VERSION"
echo "Tag         : $TAG"
echo

read -r -p "Proceed? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ---------------------------------------------------------------------------
# Step 1: CLI — bump version, build, publish beta, GitHub prerelease
# ---------------------------------------------------------------------------

step "CLI: verify branch"
CLI_CURRENT_BRANCH="$(git -C "$CLI_ROOT" branch --show-current)"
[[ "$CLI_CURRENT_BRANCH" == "$CLI_BRANCH" ]] || \
  die "CLI is on '$CLI_CURRENT_BRANCH', expected '$CLI_BRANCH'"

step "CLI: bump package.json to $PRERELEASE_VERSION"
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$CLI_ROOT/package.json', 'utf8'));
  pkg.version = '$PRERELEASE_VERSION';
  fs.writeFileSync('$CLI_ROOT/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

step "CLI: build"
pnpm --dir "$CLI_ROOT" build

step "CLI: publish to npm --tag beta"
(cd "$CLI_ROOT" && pnpm publish --tag beta --no-git-checks --access public)

step "CLI: create GitHub prerelease $TAG"
gh release create "$TAG" \
  --repo ai-driven-dev/aidd-cli \
  --prerelease \
  --target "$CLI_BRANCH" \
  --title "$TAG" \
  --generate-notes

# ---------------------------------------------------------------------------
# Step 2: Framework — install CLI beta, build dist, zip, GitHub prerelease
# ---------------------------------------------------------------------------

step "Framework: verify branch"
FW_CURRENT_BRANCH="$(git -C "$FRAMEWORK_ROOT" branch --show-current)"
[[ "$FW_CURRENT_BRANCH" == "$FRAMEWORK_BRANCH" ]] || \
  die "Framework is on '$FW_CURRENT_BRANCH', expected '$FRAMEWORK_BRANCH'"

step "Framework: create GitHub prerelease $TAG"
gh release create "$TAG" \
  --repo ai-driven-dev/framework \
  --prerelease \
  --target "$FRAMEWORK_BRANCH" \
  --title "$TAG" \
  --generate-notes

# ---------------------------------------------------------------------------
# Done — print install instructions
# ---------------------------------------------------------------------------

echo
echo "============================================================"
echo " Prerelease $TAG published!"
echo "============================================================"
echo
echo "Install CLI beta:"
echo "  npm install -g @ai-driven-dev/cli@beta"
echo "  # or"
echo "  pnpm add -g @ai-driven-dev/cli@beta"
echo
echo "Share with testers."
echo "============================================================"
