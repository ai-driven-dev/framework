#!/usr/bin/env bash
set -euo pipefail
FRAMEWORK_REPO="/Users/baptistelafourcade/Projects/freelance/aidd/aidd/framework"
FIXTURE_DIR="$(cd "$(dirname "$0")/.." && pwd)/tests/fixtures/framework-real"
TAG="${1:-$(git -C "$FRAMEWORK_REPO" describe --tags --abbrev=0)}"
echo "Snapshotting $TAG"
rm -rf "$FIXTURE_DIR"
mkdir -p "$FIXTURE_DIR"
git -C "$FRAMEWORK_REPO" archive "$TAG" | tar -x -C "$FIXTURE_DIR"
echo "Pinned to $TAG"
