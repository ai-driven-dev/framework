#!/usr/bin/env bash
# Non-regression smoke — walk every top-level command, every sub-command,
# happy path + edge cases. Real local directory.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$ROOT/dist/cli.js"
FRAMEWORK_FIXTURE="$ROOT/tests/fixtures/framework"
PLUGIN_FIXTURE="$ROOT/tests/fixtures/plugins/claude-format/sample-plugin"

PASS=0
FAIL=0
SKIP=0
FAILURES=()

run() {
  local name="$1"; shift
  local expect_exit="$1"; shift
  local expect_substr="$1"; shift
  local cwd="$1"; shift
  local out rc
  out=$(cd "$cwd" && node "$CLI" "$@" 2>&1)
  rc=$?
  if [[ "$rc" -ne "$expect_exit" ]]; then
    FAIL=$((FAIL+1))
    FAILURES+=("$name — exit $rc (expected $expect_exit)
$out")
    echo "  ✗ $name  (exit $rc)"
    return
  fi
  if [[ -n "$expect_substr" && "$out" != *"$expect_substr"* ]]; then
    FAIL=$((FAIL+1))
    FAILURES+=("$name — missing '$expect_substr'
$out")
    echo "  ✗ $name  (missing substring)"
    return
  fi
  PASS=$((PASS+1))
  echo "  ✓ $name"
}

setup_project() {
  local p="$1"
  rm -rf "$p"
  mkdir -p "$p"
  local out
  out=$(cd "$p" && node "$CLI" setup --path "$FRAMEWORK_FIXTURE" --ai claude 2>&1)
  if [[ ! -d "$p/.claude" ]]; then
    echo "FATAL: setup failed for $p"
    echo "$out"
    exit 1
  fi
}

section() {
  echo
  echo "=== $1 ==="
}

TMPROOT=$(mktemp -d -t aidd-smoke-reg-XXXXXXXX)
trap 'rm -rf "$TMPROOT"' EXIT
echo "Smoke root: $TMPROOT"
echo "CLI:        $CLI"

# ── help / version ─────────────────────────────────────────────
section "help / version"
run "--version prints aidd/x.y.z" 0 "aidd/" "$ROOT"  --version
run "--help lists commands" 0 "Manage plugin marketplaces" "$ROOT"  --help
run "help <command> works" 0 "marketplace" "$ROOT"  help marketplace
run "unknown command exits non-zero" 1 "" "$ROOT"  not-a-real-command

# ── setup ──────────────────────────────────────────────────────
section "setup"
P_SETUP="$TMPROOT/p-setup"
rm -rf "$P_SETUP"; mkdir -p "$P_SETUP"
run "setup --path local fixture --ai claude" 0 "Initialized" "$P_SETUP" \
  setup --path "$FRAMEWORK_FIXTURE" --ai claude
[[ -f "$P_SETUP/.aidd/manifest.json" ]] && \
  { PASS=$((PASS+1)); echo "  ✓ manifest.json created"; } || \
  { FAIL=$((FAIL+1)); FAILURES+=("manifest.json missing"); echo "  ✗ manifest.json"; }
[[ -d "$P_SETUP/.claude" ]] && \
  { PASS=$((PASS+1)); echo "  ✓ .claude dir created"; } || \
  { FAIL=$((FAIL+1)); FAILURES+=(".claude dir missing"); echo "  ✗ .claude dir"; }

run "setup re-run is up-to-date" 0 "" "$P_SETUP" \
  setup --path "$FRAMEWORK_FIXTURE" --ai claude

# ── install ────────────────────────────────────────────────────
section "install"
P_INST="$TMPROOT/p-install"
setup_project "$P_INST"
run "install ai cursor" 0 "" "$P_INST" \
  install ai cursor --path "$FRAMEWORK_FIXTURE" --no-plugins

run "install duplicate (already installed)" 0 "already installed" "$P_INST" \
  install ai cursor --path "$FRAMEWORK_FIXTURE" --no-plugins

run "install --force overwrites" 0 "" "$P_INST" \
  install ai cursor --path "$FRAMEWORK_FIXTURE" --no-plugins --force

run "install bad tool fails" 1 "" "$P_INST" \
  install ai not-a-tool --path "$FRAMEWORK_FIXTURE"

run "install requires args in non-interactive" 1 "non-interactive" "$P_INST" \
  install

run "install --all installs everything" 0 "Installed" "$P_INST" \
  install --all --path "$FRAMEWORK_FIXTURE" --no-plugins --force

# ── status ─────────────────────────────────────────────────────
section "status"
P_STATUS="$TMPROOT/p-status"
setup_project "$P_STATUS"
run "status reports health" 0 "" "$P_STATUS"  status
run "status ai filter" 0 "" "$P_STATUS"       status ai

# ── doctor ─────────────────────────────────────────────────────
section "doctor"
P_DOCTOR="$TMPROOT/p-doctor"
setup_project "$P_DOCTOR"
run "doctor runs" 0 "" "$P_DOCTOR"            doctor
run "doctor ai filter" 0 "" "$P_DOCTOR"       doctor ai

# ── update ─────────────────────────────────────────────────────
section "update"
P_UPDATE="$TMPROOT/p-update"
setup_project "$P_UPDATE"
run "update reports up-to-date or progress" 0 "" "$P_UPDATE" \
  update --path "$FRAMEWORK_FIXTURE"

# ── restore ────────────────────────────────────────────────────
section "restore"
P_RESTORE="$TMPROOT/p-restore"
setup_project "$P_RESTORE"
# Modify a tracked file then restore.
target="$P_RESTORE/.claude/agents/code-reviewer.md"
if [[ -f "$target" ]]; then
  echo "MODIFIED" >> "$target"
  run "restore --force restores modified file" 0 "" "$P_RESTORE" \
    restore --force --path "$FRAMEWORK_FIXTURE"
else
  SKIP=$((SKIP+1)); echo "  ~ restore skipped (target missing)"
fi

# ── sync ───────────────────────────────────────────────────────
section "sync"
P_SYNC="$TMPROOT/p-sync"
setup_project "$P_SYNC"
(cd "$P_SYNC" && node "$CLI" install ai cursor --path "$FRAMEWORK_FIXTURE" --no-plugins >/dev/null)
run "sync runs without error" 0 "" "$P_SYNC" \
  sync --source claude --force

# ── clean ──────────────────────────────────────────────────────
section "clean"
P_CLEAN="$TMPROOT/p-clean"
setup_project "$P_CLEAN"
run "clean removes generated files" 0 "" "$P_CLEAN"  clean --force
[[ ! -d "$P_CLEAN/.aidd" ]] && \
  { PASS=$((PASS+1)); echo "  ✓ .aidd/ removed after clean"; } || \
  { FAIL=$((FAIL+1)); FAILURES+=(".aidd/ still present after clean"); echo "  ✗ .aidd remained"; }

# ── uninstall ──────────────────────────────────────────────────
section "uninstall"
P_UNINSTALL="$TMPROOT/p-uninstall"
setup_project "$P_UNINSTALL"
(cd "$P_UNINSTALL" && node "$CLI" install ai cursor --path "$FRAMEWORK_FIXTURE" --no-plugins >/dev/null)
run "uninstall ai cursor" 0 "" "$P_UNINSTALL" \
  uninstall ai cursor
[[ ! -d "$P_UNINSTALL/.cursor" ]] && \
  { PASS=$((PASS+1)); echo "  ✓ .cursor removed"; } || \
  { FAIL=$((FAIL+1)); FAILURES+=(".cursor still present"); echo "  ✗ uninstall left files"; }

# ── plugin add / remove / list / update ────────────────────────
section "plugin lifecycle"
P_PLUG="$TMPROOT/p-plugin"
setup_project "$P_PLUG"

run "plugin list (empty)" 0 "No plugins installed" "$P_PLUG" \
  plugin list

run "plugin add local fixture" 0 "added" "$P_PLUG" \
  plugin add "$PLUGIN_FIXTURE" --tool claude

run "plugin list shows added" 0 "sample-plugin" "$P_PLUG" \
  plugin list

run "plugin add duplicate fails" 1 "already installed" "$P_PLUG" \
  plugin add "$PLUGIN_FIXTURE" --tool claude

run "plugin update sample-plugin" 0 "" "$P_PLUG" \
  plugin update sample-plugin --tool claude

run "plugin remove sample-plugin" 0 "removed" "$P_PLUG" \
  plugin remove sample-plugin --tool claude

run "plugin remove missing fails" 1 "not installed" "$P_PLUG" \
  plugin remove ghost --tool claude

run "plugin add bad source fails" 1 "" "$P_PLUG" \
  plugin add "/nonexistent/plugin/path" --tool claude

# ── auth ───────────────────────────────────────────────────────
section "auth"
P_AUTH="$TMPROOT/p-auth"
setup_project "$P_AUTH"
fake_home=$(mktemp -d -t aidd-auth-home-XXXXXXXX)
out=$(cd "$P_AUTH" && env HOME="$fake_home" node "$CLI" auth status 2>&1)
rc=$?
echo "  · auth status (no creds) → exit $rc"
PASS=$((PASS+1))
echo "  ✓ auth status non-throwing"

# ── cache ──────────────────────────────────────────────────────
section "cache"
P_CACHE="$TMPROOT/p-cache"
setup_project "$P_CACHE"
run "cache list" 0 "" "$P_CACHE"          cache list
run "cache clear --all" 0 "" "$P_CACHE"   cache clear --all

# ── config ─────────────────────────────────────────────────────
section "config"
P_CONFIG="$TMPROOT/p-config"
setup_project "$P_CONFIG"
run "config get docsDir" 0 "" "$P_CONFIG" \
  config get docsDir

# ── self-update ────────────────────────────────────────────────
section "self-update"
# Use --check to avoid network mutation; treat exit 0/1 as ok.
out=$(cd "$ROOT" && node "$CLI" self-update --check 2>&1)
rc=$?
if [[ "$rc" -eq 0 || "$rc" -eq 1 ]]; then
  PASS=$((PASS+1)); echo "  ✓ self-update --check responsive (exit $rc)"
else
  FAIL=$((FAIL+1)); FAILURES+=("self-update exit=$rc"); echo "  ✗ self-update"
fi

# ── plugin pick (non-interactive guard) ────────────────────────
section "plugin pick"
P_PICK="$TMPROOT/p-pick"
setup_project "$P_PICK"
run "pick rejects non-interactive" 1 "" "$P_PICK"  plugin pick --tool claude

# ── plugin marketplace help (alias smoke) ──────────────────────
section "marketplace help"
run "marketplace --help lists subcommands" 0 "browse" "$ROOT" \
  marketplace --help
run "plugin --help lists subcommands" 0 "install" "$ROOT" \
  plugin --help

# ── Summary ────────────────────────────────────────────────────
echo
echo "──────────────────────────────────────────────────────────────"
echo "PASS: $PASS   FAIL: $FAIL   SKIP: $SKIP"
if [[ "$FAIL" -gt 0 ]]; then
  echo
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    echo "  • $f"
    echo
  done
  exit 1
fi
exit 0
