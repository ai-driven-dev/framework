#!/usr/bin/env bash
# Automated test suite for AIDD CLI — no interactive prompts

CLI="/Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/dist/cli.js"
FW="/Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/tests/fixtures/framework"
FW_V2="/Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/tests/fixtures/framework-v2"
FW_OPT="--framework $FW"

PASS=0
FAIL=0
SKIP=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$SCRIPT_DIR/projects"
rm -rf "$RUN_DIR"
mkdir -p "$RUN_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] contains: $needle"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [$label] expected to contain: $needle"
    echo -e "  ${RED}       actual output: $(echo "$haystack" | head -5)${RESET}"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo -e "  ${RED}✗ FAIL${RESET} [$label] expected NOT to contain: $needle"
    echo -e "  ${RED}       actual output: $(echo "$haystack" | head -5)${RESET}"
    FAIL=$((FAIL + 1))
  else
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] does not contain: $needle"
    PASS=$((PASS + 1))
  fi
}

assert_exit_ok() {
  local label="$1" code="$2"
  if [[ "$code" -eq 0 ]]; then
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] exit code 0"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [$label] expected exit 0, got $code"
    FAIL=$((FAIL + 1))
  fi
}

assert_exit_err() {
  local label="$1" code="$2"
  if [[ "$code" -ne 0 ]]; then
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] exit code $code (non-zero)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [$label] expected non-zero exit, got 0"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_exists() {
  local label="$1" path="$2"
  if [[ -e "$path" ]]; then
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] exists: $path"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [$label] missing: $path"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_missing() {
  local label="$1" path="$2"
  if [[ ! -e "$path" ]]; then
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] absent: $path"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [$label] should not exist: $path"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_contains() {
  local label="$1" path="$2" content="$3"
  if [[ -f "$path" ]] && grep -qF "$content" "$path"; then
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] file contains: $content"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [$label] file missing or does not contain: $content"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_not_contains() {
  local label="$1" path="$2" content="$3"
  if [[ ! -f "$path" ]] || ! grep -qF "$content" "$path"; then
    echo -e "  ${GREEN}✓ PASS${RESET} [$label] file does not contain: $content"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [$label] file should not contain: $content"
    FAIL=$((FAIL + 1))
  fi
}

new_project() {
  local name="$1"
  local dir="$RUN_DIR/$name"
  rm -rf "$dir"
  mkdir -p "$dir"
  echo "$dir"
}

run_cmd() {
  local dir="$1"; shift
  local out ec
  out=$(cd "$dir" && node "$CLI" "$@" 2>&1)
  ec=$?
  echo "$out"
  return $ec
}

step() {
  local num="$1" desc="$2"
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}[${num}] ${desc}${RESET}"
}

summary() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}RÉSUMÉ${RESET}"
  echo -e "${GREEN}  PASS : $PASS${RESET}"
  echo -e "${RED}  FAIL : $FAIL${RESET}"
  echo -e "${YELLOW}  SKIP : $SKIP${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  if [[ $FAIL -gt 0 ]]; then
    exit 1
  fi
}

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        AIDD CLI — Test automatique complet               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "CLI     : $CLI"
echo -e "FIXTURE : $FW"
echo ""

# ─────────────────────────────────────────────
# Projets réutilisés
# ─────────────────────────────────────────────
P="$(new_project "main")"
P_EMPTY="$(new_project "empty")"

# ─────────────────────────────────────────────
# INIT
# ─────────────────────────────────────────────
step "01" "init — premier init dans un projet vide"
out=$(run_cmd "$P" init $FW_OPT --verbose); ec=$?
assert_exit_ok "01-exit" $ec
assert_contains "01-manifest" "$out" "Initialized"
assert_file_exists "01-manifest-json" "$P/.aidd/manifest.json"
assert_file_exists "01-docs" "$P/aidd_docs"

step "02" "init --force — ré-init dans un projet déjà initialisé"
out=$(run_cmd "$P" init $FW_OPT --force --verbose); ec=$?
assert_exit_ok "02-exit" $ec
assert_contains "02-initialized" "$out" "Initialized"
assert_file_exists "02-manifest-json" "$P/.aidd/manifest.json"

step "03" "init dans un projet non initialisé (sans --framework)"
P_OFFLINE="$(new_project "offline")"
if gh auth token > /dev/null 2>&1 || [[ -n "${AIDD_TOKEN:-}" ]]; then
  out=$(run_cmd "$P_OFFLINE" init --verbose); ec=$?
  assert_exit_ok "03-exit" $ec
  assert_contains "03-initialized" "$out" "Initialized"
  assert_file_exists "03-manifest" "$P_OFFLINE/.aidd/manifest.json"
else
  echo -e "  ${YELLOW}⊘ SKIP — no auth token available${RESET}"
  SKIP=$((SKIP + 1))
fi

step "04" "init --repo — persiste le repo custom dans le manifest"
P_REPO="$(new_project "custom-repo")"
out=$(run_cmd "$P_REPO" init $FW_OPT --repo my-org/custom-framework); ec=$?
assert_exit_ok "04-exit" $ec
out2=$(run_cmd "$P_REPO" config get repo); ec2=$?
assert_exit_ok "04-config-exit" $ec2
assert_contains "04-repo-value" "$out2" "my-org/custom-framework"

step "05" "init dans un projet déjà initialisé (sans --force)"
P_ALREADY="$(new_project "already-init")"
run_cmd "$P_ALREADY" init $FW_OPT > /dev/null 2>&1 || true
out=$(run_cmd "$P_ALREADY" init $FW_OPT); ec=$?
assert_exit_err "05-exit" $ec
assert_contains "05-error" "$out" "Already initialized"

# ─────────────────────────────────────────────
# INSTALL
# ─────────────────────────────────────────────
step "06" "install claude"
out=$(run_cmd "$P" install claude $FW_OPT --verbose); ec=$?
assert_exit_ok "06-exit" $ec
assert_contains "06-installed" "$out" "Installed claude"
assert_file_exists "06-claude-dir" "$P/.claude"

step "07" "install cursor"
out=$(run_cmd "$P" install cursor $FW_OPT --verbose); ec=$?
assert_exit_ok "07-exit" $ec
assert_contains "07-installed" "$out" "Installed cursor"
assert_file_exists "07-cursor-dir" "$P/.cursor"

step "08" "install copilot"
out=$(run_cmd "$P" install copilot $FW_OPT --verbose); ec=$?
assert_exit_ok "08-exit" $ec
assert_contains "08-installed" "$out" "Installed copilot"
assert_file_exists "08-copilot-dir" "$P/.github"

step "09" "install outil déjà installé (sans --force)"
out=$(run_cmd "$P" install claude $FW_OPT --verbose); ec=$?
assert_exit_ok "09-exit" $ec
assert_contains "09-already" "$out" "already installed"

step "10" "install outil déjà installé avec --force"
out=$(run_cmd "$P" install claude $FW_OPT --force --verbose); ec=$?
assert_exit_ok "10-exit" $ec
assert_contains "10-installed" "$out" "Installed claude"

step "11" "install dans un projet non initialisé"
out=$(run_cmd "$P_EMPTY" install claude $FW_OPT --verbose); ec=$?
assert_exit_err "11-exit" $ec
assert_contains "11-error" "$out" "No AIDD installation found"

step "12" "install --all — installe tous les outils"
P_ALL="$(new_project "all-tools")"
run_cmd "$P_ALL" init $FW_OPT > /dev/null 2>&1 || true
out=$(run_cmd "$P_ALL" install --all $FW_OPT --verbose); ec=$?
assert_exit_ok "12-exit" $ec
assert_contains "12-all-installed" "$out" "Installed claude, cursor, copilot"
assert_file_exists "12-claude-dir" "$P_ALL/.claude"
assert_file_exists "12-cursor-dir" "$P_ALL/.cursor"

# ─────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────
step "13" "status — tous les outils installés"
out=$(run_cmd "$P" status $FW_OPT); ec=$?
assert_exit_ok "13-exit" $ec
assert_contains "13-sync" "$out" "in sync"

step "14" "status dans un projet non initialisé"
out=$(run_cmd "$P_EMPTY" status $FW_OPT); ec=$?
assert_exit_err "14-exit" $ec
assert_contains "14-error" "$out" "No AIDD installation found"

step "15" "status --tool claude — filtre par outil (pas de mention cursor)"
out=$(run_cmd "$P" status --tool claude $FW_OPT); ec=$?
assert_exit_ok "15-exit" $ec
assert_contains "15-in-sync" "$out" "in sync"
assert_not_contains "15-no-cursor" "$out" "cursor"

# ─────────────────────────────────────────────
# DOCTOR
# ─────────────────────────────────────────────
step "16" "doctor — projet sain"
out=$(run_cmd "$P" doctor $FW_OPT); ec=$?
assert_exit_ok "16-exit" $ec
assert_contains "16-healthy" "$out" "healthy"

step "17" "doctor — projet non initialisé"
out=$(run_cmd "$P_EMPTY" doctor $FW_OPT); ec=$?
assert_exit_err "17-exit" $ec
assert_contains "17-error" "$out" "No AIDD installation found"

step "18" "doctor — dossier docs manquant sur disque"
rm -rf "$P/aidd_docs"
out=$(run_cmd "$P" doctor $FW_OPT); ec=$?
assert_exit_err "18-exit" $ec
assert_contains "18-docs-missing" "$out" "does not exist on disk"
# Restore
run_cmd "$P" init $FW_OPT --force > /dev/null 2>&1 || true
run_cmd "$P" install claude $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P" install cursor $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P" install copilot $FW_OPT > /dev/null 2>&1 || true

step "19" "doctor — dossier outil orphelin (présent sur disque, non tracké)"
run_cmd "$P" uninstall copilot $FW_OPT > /dev/null 2>&1 || true
mkdir -p "$P/.github"
echo "test" > "$P/.github/copilot-instructions.md"
out=$(run_cmd "$P" doctor $FW_OPT); ec=$?
assert_exit_err "19-exit" $ec
assert_contains "19-orphan" "$out" "Orphaned directory"
rm -rf "$P/.github"

step "20" "doctor — référence @ cassée dans un fichier tracké"
TRACKED_MD=$(find "$P/.claude" -name "*.md" 2>/dev/null | head -1)
if [[ -f "$TRACKED_MD" ]]; then
  echo "See @missing/file.md for details" >> "$TRACKED_MD"
  out=$(run_cmd "$P" doctor $FW_OPT); ec=$?
  assert_exit_err "20-exit" $ec
  assert_contains "20-broken-ref" "$out" "Broken reference"
  run_cmd "$P" restore $FW_OPT --force > /dev/null 2>&1 || true
else
  echo -e "  ${YELLOW}⊘ SKIP — aucun fichier tracké trouvé${RESET}"
  SKIP=$((SKIP + 1))
fi

step "21" "doctor --fix — restaure les fichiers cassés"
run_cmd "$P" install copilot $FW_OPT > /dev/null 2>&1 || true
VICTIM_D=$(find "$P/.claude" -name "*.md" 2>/dev/null | head -1)
if [[ -f "$VICTIM_D" ]]; then
  rm "$VICTIM_D"
  out=$(run_cmd "$P" doctor $FW_OPT --fix); ec=$?
  assert_file_exists "21-restored" "$VICTIM_D"
  assert_contains "21-restored-msg" "$out" "Restored"
else
  echo -e "  ${YELLOW}⊘ SKIP — aucun fichier .md dans .claude/${RESET}"
  SKIP=$((SKIP + 1))
fi

# ─────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────
run_cmd "$P" install copilot $FW_OPT > /dev/null 2>&1 || true

step "22" "update — projet à jour, aucune modification"
out=$(run_cmd "$P" update $FW_OPT --verbose); ec=$?
assert_exit_ok "22-exit" $ec
assert_contains "22-uptodate" "$out" "Already up to date"

step "23" "update — fichier modifié (conflit → .backup créé) avec fixture locale"
P_UPDATE="$(new_project "update-conflict")"
run_cmd "$P_UPDATE" init --framework "$FW" > /dev/null 2>&1 || true
run_cmd "$P_UPDATE" install claude --framework "$FW" > /dev/null 2>&1 || true
# naming.md changed between FW and FW_V2 — modify it to create a conflict
TARGET_U="$P_UPDATE/.claude/rules/01-standards/naming.md"
if [[ -f "$TARGET_U" ]]; then
  echo "# user modification" >> "$TARGET_U"
  out=$(run_cmd "$P_UPDATE" update --framework "$FW_V2" --force --verbose); ec=$?
  assert_exit_ok "23-exit" $ec
  assert_file_exists "23-backup" "${TARGET_U}.backup"
  assert_file_contains "23-backup-content" "${TARGET_U}.backup" "# user modification"
  assert_file_contains "23-updated-content" "$TARGET_U" "UPPER_SNAKE_CASE"
else
  echo -e "  ${YELLOW}⊘ SKIP — naming.md absent${RESET}"
  SKIP=$((SKIP + 1))
fi

step "24" "update --dry-run — simulation sans écriture"
SENTINEL_FILE=$(find "$P/.claude" -name "*.md" 2>/dev/null | head -1)
SENTINEL_BEFORE=""
if [[ -f "$SENTINEL_FILE" ]]; then
  SENTINEL_BEFORE=$(md5 -q "$SENTINEL_FILE" 2>/dev/null || md5sum "$SENTINEL_FILE" | cut -d' ' -f1)
fi
out=$(run_cmd "$P" update $FW_OPT --dry-run --verbose); ec=$?
assert_exit_ok "24-exit" $ec
if [[ -f "$SENTINEL_FILE" ]]; then
  SENTINEL_AFTER=$(md5 -q "$SENTINEL_FILE" 2>/dev/null || md5sum "$SENTINEL_FILE" | cut -d' ' -f1)
  if [[ "$SENTINEL_BEFORE" == "$SENTINEL_AFTER" ]]; then
    echo -e "  ${GREEN}✓ PASS${RESET} [24-no-write] file unchanged (dry-run correct)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [24-no-write] file was modified during dry-run"
    FAIL=$((FAIL + 1))
  fi
fi

step "25" "update --force — écrase les conflits sans confirmation"
out=$(run_cmd "$P" update $FW_OPT --force --verbose); ec=$?
assert_exit_ok "25-exit" $ec
assert_not_contains "25-no-prompt" "$out" "Use --force"

step "26" "update sans manifest"
out=$(run_cmd "$P_EMPTY" update $FW_OPT); ec=$?
assert_exit_err "26-exit" $ec
assert_contains "26-error" "$out" "No AIDD installation found"

# ─────────────────────────────────────────────
# UPDATE — docs
# ─────────────────────────────────────────────
step "26b" "update — docs mis à jour vers FW_V2 (README contient 'v2 Update')"
P_DOCS_UPDATE="$(new_project "docs-update")"
run_cmd "$P_DOCS_UPDATE" init --framework "$FW" > /dev/null 2>&1 || true
run_cmd "$P_DOCS_UPDATE" install claude --framework "$FW" > /dev/null 2>&1 || true
README_U="$P_DOCS_UPDATE/aidd_docs/README.md"
if [[ -f "$README_U" ]]; then
  out=$(run_cmd "$P_DOCS_UPDATE" update --framework "$FW_V2" --verbose); ec=$?
  assert_exit_ok "26b-exit" $ec
  assert_file_contains "26b-docs-updated" "$README_U" "v2 Update"
else
  echo -e "  ${YELLOW}⊘ SKIP — aidd_docs/README.md absent${RESET}"
  SKIP=$((SKIP + 1))
fi

# ─────────────────────────────────────────────
# RESTORE
# ─────────────────────────────────────────────
run_cmd "$P" restore $FW_OPT --force > /dev/null 2>&1 || true

step "27" "restore — fichier supprimé sur disque, restauré"
VICTIM="$(find "$P/.claude" -name "*.md" 2>/dev/null | head -1)"
if [[ -f "$VICTIM" ]]; then
  rm "$VICTIM"
  out=$(run_cmd "$P" restore $FW_OPT --force --verbose); ec=$?
  assert_exit_ok "27-exit" $ec
  assert_file_exists "27-restored" "$VICTIM"
  assert_contains "27-msg" "$out" "Restored"
else
  echo -e "  ${YELLOW}⊘ SKIP — aucun .md dans .claude/${RESET}"
  SKIP=$((SKIP + 1))
fi

step "28" "restore <fichier> — restaure un fichier spécifique (arg positionnel)"
VICTIM2_ABS="$(find "$P/.claude" -name "*.md" 2>/dev/null | head -1)"
if [[ -f "$VICTIM2_ABS" ]]; then
  # restore expects a path relative to the project dir
  VICTIM2_REL="${VICTIM2_ABS#$P/}"
  echo "# modified" >> "$VICTIM2_ABS"
  BEFORE=$(md5 -q "$VICTIM2_ABS" 2>/dev/null || md5sum "$VICTIM2_ABS" | cut -d' ' -f1)
  out=$(run_cmd "$P" restore "$VICTIM2_REL" $FW_OPT --force --verbose); ec=$?
  AFTER=$(md5 -q "$VICTIM2_ABS" 2>/dev/null || md5sum "$VICTIM2_ABS" | cut -d' ' -f1)
  assert_exit_ok "28-exit" $ec
  if [[ "$BEFORE" != "$AFTER" ]]; then
    echo -e "  ${GREEN}✓ PASS${RESET} [28-restored] file content changed (restored)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗ FAIL${RESET} [28-restored] file content unchanged (restore did nothing)"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "  ${YELLOW}⊘ SKIP — aucun .md dans .claude/${RESET}"
  SKIP=$((SKIP + 1))
fi

step "29" "restore --tool claude — scope à un seul outil (rien à restaurer → rapport propre)"
out=$(run_cmd "$P" restore $FW_OPT --tool claude --force --verbose); ec=$?
assert_exit_ok "29-exit" $ec
assert_not_contains "29-no-error" "$out" "Error"
assert_not_contains "29-no-cursor" "$out" "cursor"

step "30" "restore sans --force en mode non-TTY"
out=$(run_cmd "$P" restore $FW_OPT); ec=$?
assert_exit_err "30-exit" $ec
assert_contains "30-error" "$out" "Restore requires --force"

step "31" "restore sans manifest"
out=$(run_cmd "$P_EMPTY" restore $FW_OPT --force); ec=$?
assert_exit_err "31-exit" $ec
assert_contains "31-error" "$out" "No AIDD installation found"

# ─────────────────────────────────────────────
# RESTORE — docs
# ─────────────────────────────────────────────
step "31b" "restore — fichier docs modifié, restauré"
if [[ -f "$P/aidd_docs/README.md" ]]; then
  echo "# user modification" >> "$P/aidd_docs/README.md"
  out=$(run_cmd "$P" restore $FW_OPT --force --verbose); ec=$?
  assert_exit_ok "31b-exit" $ec
  assert_contains "31b-restored" "$out" "Restored"
  assert_file_not_contains "31b-content-restored" "$P/aidd_docs/README.md" "# user modification"
else
  echo -e "  ${YELLOW}⊘ SKIP — aidd_docs/README.md absent${RESET}"
  SKIP=$((SKIP + 1))
fi

# ─────────────────────────────────────────────
# SYNC
# ─────────────────────────────────────────────
step "32" "sync --source claude --target cursor — modification propagée"
SYNC_FILE="$(find "$P/.claude" -name "*.md" 2>/dev/null | head -1)"
if [[ -f "$SYNC_FILE" ]]; then
  SYNC_REL="${SYNC_FILE#$P/.claude/}"
  echo "# sync test" >> "$SYNC_FILE"
  out=$(run_cmd "$P" sync --source claude --target cursor $FW_OPT --verbose); ec=$?
  assert_exit_ok "32-exit" $ec
  assert_contains "32-synced" "$out" "Synced"
  assert_file_contains "32-propagated" "$P/.cursor/$SYNC_REL" "# sync test"
else
  echo -e "  ${YELLOW}⊘ SKIP — aucun .md dans .claude/${RESET}"
  SKIP=$((SKIP + 1))
fi

step "33" "sync --source claude --target cursor --force — pas d'erreur même si déjà en sync"
out=$(run_cmd "$P" sync --source claude --target cursor $FW_OPT --force --verbose); ec=$?
assert_exit_ok "33-exit" $ec
assert_not_contains "33-no-error" "$out" "Error"

step "34" "sync --source claude — vers tous les outils (cursor + copilot)"
out=$(run_cmd "$P" sync --source claude $FW_OPT --verbose); ec=$?
assert_exit_ok "34-exit" $ec
assert_contains "34-cursor" "$out" "cursor"
assert_contains "34-copilot" "$out" "copilot"

step "35" "sync --source claude --target claude — source = cible"
out=$(run_cmd "$P" sync --source claude --target claude $FW_OPT); ec=$?
assert_exit_err "35-exit" $ec
assert_contains "35-error" "$out" "cannot be the same"

step "36" "sync vers outil non installé"
P_SINGLE="$(new_project "single-tool")"
run_cmd "$P_SINGLE" init $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_SINGLE" install claude $FW_OPT > /dev/null 2>&1 || true
out=$(run_cmd "$P_SINGLE" sync --source claude --target cursor $FW_OPT); ec=$?
assert_exit_err "36-exit" $ec
assert_contains "36-error" "$out" "requires at least 2 installed tools"

# ─────────────────────────────────────────────
# UNINSTALL
# ─────────────────────────────────────────────
run_cmd "$P" install copilot $FW_OPT > /dev/null 2>&1 || true

step "37" "uninstall copilot"
out=$(run_cmd "$P" uninstall copilot $FW_OPT --verbose); ec=$?
assert_exit_ok "37-exit" $ec
assert_contains "37-uninstalled" "$out" "Uninstalled copilot"
assert_file_missing "37-copilot-dir" "$P/.github"

step "38" "uninstall --all — désinstalle tous les outils"
P_UNINST="$(new_project "uninstall-all")"
run_cmd "$P_UNINST" init $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_UNINST" install claude $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_UNINST" install cursor $FW_OPT > /dev/null 2>&1 || true
out=$(run_cmd "$P_UNINST" uninstall --all $FW_OPT --verbose); ec=$?
assert_exit_ok "38-exit" $ec
assert_file_missing "38-claude-dir" "$P_UNINST/.claude"
assert_file_missing "38-cursor-dir" "$P_UNINST/.cursor"

step "39" "uninstall outil non installé"
out=$(run_cmd "$P" uninstall copilot $FW_OPT); ec=$?
assert_exit_err "39-exit" $ec
assert_contains "39-error" "$out" "not installed"

# ─────────────────────────────────────────────
# CACHE
# ─────────────────────────────────────────────
step "40" "cache list — liste les versions en cache (ou indique qu'il est vide)"
out=$(run_cmd "$P" cache list); ec=$?
assert_exit_ok "40-exit" $ec
assert_contains "40-output" "$out" "cached"

step "41" "cache clear <version inexistante>"
out=$(run_cmd "$P" cache clear 99.99.99); ec=$?
assert_exit_err "41-exit" $ec
assert_contains "41-error" "$out" "No cached framework found for version"

step "42" "cache clear --all — vide tout le cache"
out=$(run_cmd "$P" cache clear --all); ec=$?
assert_exit_ok "42-exit" $ec

step "43" "cache clear --all <version> — options mutuellement exclusives"
out=$(run_cmd "$P" cache clear 1.0.0 --all); ec=$?
assert_exit_err "43-exit" $ec
assert_contains "43-error" "$out" "Cannot specify both"

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
run_cmd "$P" install claude $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P" install cursor $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P" install copilot $FW_OPT > /dev/null 2>&1 || true

step "44" "config list — affiche docsDir, repo, tools"
out=$(run_cmd "$P" config list); ec=$?
assert_exit_ok "44-exit" $ec
assert_contains "44-docsDir" "$out" "docsDir"
assert_contains "44-repo" "$out" "repo"
assert_contains "44-tools" "$out" "tools"

step "45" "config get docsDir"
out=$(run_cmd "$P" config get docsDir); ec=$?
assert_exit_ok "45-exit" $ec
assert_contains "45-value" "$out" "aidd_docs"

step "46" "config get repo — default si non défini"
out=$(run_cmd "$P" config get repo); ec=$?
assert_exit_ok "46-exit" $ec
assert_contains "46-value" "$out" "ai-driven-dev/aidd-framework"

step "47" "config get tools — liste des outils installés"
out=$(run_cmd "$P" config get tools); ec=$?
assert_exit_ok "47-exit" $ec
assert_contains "47-claude" "$out" "claude"

step "48" "config set repo my-org/custom-framework --force"
out=$(run_cmd "$P" config set repo my-org/custom-framework --force); ec=$?
assert_exit_ok "48-exit" $ec
out2=$(run_cmd "$P" config get repo); ec2=$?
assert_contains "48-value" "$out2" "my-org/custom-framework"
# Reset
run_cmd "$P" config set repo ai-driven-dev/aidd-framework --force > /dev/null 2>&1 || true

step "49" "config set repo format invalide — erreur de validation"
out=$(run_cmd "$P" config set repo not-valid-format --force); ec=$?
assert_exit_err "49-exit" $ec
assert_contains "49-error" "$out" "Invalid repository format"

step "50" "config set repo identique — no-op"
out=$(run_cmd "$P" config set repo ai-driven-dev/aidd-framework --force); ec=$?
assert_exit_ok "50-exit" $ec
assert_contains "50-already" "$out" "already"

step "51" "config set docsDir my_docs --force (dossier inexistant)"
out=$(run_cmd "$P" config set docsDir my_docs --force); ec=$?
assert_exit_ok "51-exit" $ec
assert_contains "51-warning" "$out" "does not exist on disk"
out2=$(run_cmd "$P" config get docsDir); ec2=$?
assert_contains "51-value" "$out2" "my_docs"

step "52" "config set docsDir aidd_docs --force (dossier existe sur disque)"
out=$(run_cmd "$P" config set docsDir aidd_docs --force); ec=$?
assert_exit_ok "52-exit" $ec
assert_contains "52-found" "$out" "found on disk"
out2=$(run_cmd "$P" config get docsDir); ec2=$?
assert_contains "52-value" "$out2" "aidd_docs"

step "53" "config set docsDir sans --force en mode non-TTY"
out=$(run_cmd "$P" config set docsDir my_docs); ec=$?
assert_exit_err "53-exit" $ec
assert_contains "53-error" "$out" "Confirmation required"

step "54" "config set tools — clé read-only"
out=$(run_cmd "$P" config set tools claude,cursor --force); ec=$?
assert_exit_err "54-exit" $ec
assert_contains "54-readonly" "$out" "read-only"

step "55" "config set clé inconnue"
out=$(run_cmd "$P" config set verbose true --force); ec=$?
assert_exit_err "55-exit" $ec
assert_contains "55-unknown" "$out" "Unknown key"

step "56" "config sans manifest"
out=$(run_cmd "$P_EMPTY" config list); ec=$?
assert_exit_err "56-exit" $ec
assert_contains "56-error" "$out" "No AIDD installation found"

# ─────────────────────────────────────────────
# CLEAN
# ─────────────────────────────────────────────
step "57" "clean (sans --force) — dry-run"
P_CLEAN="$(new_project "clean-test")"
run_cmd "$P_CLEAN" init $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_CLEAN" install claude $FW_OPT > /dev/null 2>&1 || true
out=$(run_cmd "$P_CLEAN" clean --verbose); ec=$?
assert_exit_ok "57-exit" $ec
assert_contains "57-would-remove" "$out" "Would remove"
assert_file_exists "57-aidd-preserved" "$P_CLEAN/.aidd"

step "58" "clean --force — supprime tout ce qu'aidd a installé"
out=$(run_cmd "$P_CLEAN" clean --force --verbose); ec=$?
assert_exit_ok "58-exit" $ec
assert_file_missing "58-aidd-removed" "$P_CLEAN/.aidd"
assert_file_missing "58-claude-removed" "$P_CLEAN/.claude"

step "59" "clean sans manifest"
out=$(run_cmd "$P_EMPTY" clean --force); ec=$?
assert_exit_ok "59-exit" $ec
assert_contains "59-nothing" "$out" "Nothing to clean"

# ─────────────────────────────────────────────
# OPTIONS GLOBALES
# ─────────────────────────────────────────────
step "60" "aidd --version"
out=$(run_cmd "$P" --version); ec=$?
assert_exit_ok "60-exit" $ec
assert_contains "60-version" "$out" "aidd/"

step "61" "aidd --help"
out=$(run_cmd "$P" --help); ec=$?
assert_exit_ok "61-exit" $ec
assert_contains "61-usage" "$out" "Usage: aidd"

step "62" "aidd init --help"
out=$(run_cmd "$P" init --help); ec=$?
assert_exit_ok "62-exit" $ec
assert_contains "62-usage" "$out" "Usage: aidd init"

step "63" "aidd config --help"
out=$(run_cmd "$P" config --help); ec=$?
assert_exit_ok "63-exit" $ec
assert_contains "63-subcommands" "$out" "list"

# ─────────────────────────────────────────────
# ADOPT
# ─────────────────────────────────────────────
P_ADOPT="$(new_project "adopt-test")"

step "64" "init quand .claude/ existe sans manifest — redirigé vers adopt"
mkdir -p "$P_ADOPT/.claude"
out=$(run_cmd "$P_ADOPT" init $FW_OPT); ec=$?
assert_exit_err "64-exit" $ec
assert_contains "64-adopt" "$out" "aidd adopt"

step "65" "adopt — aucun dossier outil détecté"
P_ADOPT_EMPTY="$(new_project "adopt-empty")"
out=$(run_cmd "$P_ADOPT_EMPTY" adopt $FW_OPT); ec=$?
assert_exit_err "65-exit" $ec
assert_contains "65-error" "$out" "No AIDD directories found"

step "66" "adopt — manifest déjà existant"
P_ADOPT_EXISTING="$(new_project "adopt-existing")"
run_cmd "$P_ADOPT_EXISTING" init $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_ADOPT_EXISTING" install claude $FW_OPT > /dev/null 2>&1 || true
out=$(run_cmd "$P_ADOPT_EXISTING" adopt $FW_OPT --force); ec=$?
assert_exit_err "66-exit" $ec
assert_contains "66-error" "$out" "Already initialized"

step "67" "adopt --force — .claude/ préexistant, crée le manifest"
out=$(run_cmd "$P_ADOPT" adopt $FW_OPT --force --verbose); ec=$?
assert_exit_ok "67-exit" $ec
assert_file_exists "67-manifest" "$P_ADOPT/.aidd/manifest.json"
assert_file_exists "67-catalog" "$P_ADOPT/aidd_docs/CATALOG.md"

step "68" "adopt --force puis status — aucune dérive"
out=$(run_cmd "$P_ADOPT" status $FW_OPT); ec=$?
assert_exit_ok "68-exit" $ec
assert_contains "68-sync" "$out" "in sync"

step "69" "adopt --force — fichiers orphelins signalés, non supprimés"
P_ADOPT_ORPHAN="$(new_project "adopt-orphan")"
run_cmd "$P_ADOPT_ORPHAN" init $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_ADOPT_ORPHAN" install claude $FW_OPT > /dev/null 2>&1 || true
echo "my custom rule" > "$P_ADOPT_ORPHAN/.claude/rules/user-custom.md"
rm -rf "$P_ADOPT_ORPHAN/.aidd"
out=$(run_cmd "$P_ADOPT_ORPHAN" adopt $FW_OPT --force --verbose); ec=$?
assert_exit_ok "69-exit" $ec
assert_file_exists "69-orphan-preserved" "$P_ADOPT_ORPHAN/.claude/rules/user-custom.md"
assert_contains "69-orphan-warned" "$out" "orphan"

step "70" "adopt --force — .claude/ + .cursor/ → deux outils adoptés"
P_ADOPT_MULTI="$(new_project "adopt-multi")"
run_cmd "$P_ADOPT_MULTI" init $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_ADOPT_MULTI" install claude $FW_OPT > /dev/null 2>&1 || true
run_cmd "$P_ADOPT_MULTI" install cursor $FW_OPT > /dev/null 2>&1 || true
rm -rf "$P_ADOPT_MULTI/.aidd"
out=$(run_cmd "$P_ADOPT_MULTI" adopt $FW_OPT --force --verbose); ec=$?
assert_exit_ok "70-exit" $ec
TOOLS_IN_MANIFEST=$(python3 -c "
import json, sys
try:
  d = json.load(open('$P_ADOPT_MULTI/.aidd/manifest.json'))
  tools = list(d.get('tools', {}).keys())
  print(','.join(tools))
  sys.exit(0 if 'claude' in tools and 'cursor' in tools else 1)
except Exception as e:
  print('ERROR:', e)
  sys.exit(1)
" 2>&1)
if [[ $? -eq 0 ]]; then
  echo -e "  ${GREEN}✓ PASS${RESET} [70-tools] manifest contains claude + cursor: $TOOLS_IN_MANIFEST"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗ FAIL${RESET} [70-tools] manifest tools incorrect: $TOOLS_IN_MANIFEST"
  FAIL=$((FAIL + 1))
fi

step "71" "adopt --help — affiche l'aide de la commande"
out=$(run_cmd "$P" adopt --help); ec=$?
assert_exit_ok "71-exit" $ec
assert_contains "71-usage" "$out" "Usage: aidd adopt"

# ─────────────────────────────────────────────
# REMOTE TESTS (sans --framework)
# ─────────────────────────────────────────────
HAVE_TOKEN=0
if gh auth token > /dev/null 2>&1 || [[ -n "${AIDD_TOKEN:-}" ]]; then
  HAVE_TOKEN=1
fi

step "R1" "remote init vide — télécharge et initialise"
if [[ $HAVE_TOKEN -eq 1 ]]; then
  P_REMOTE="$(new_project "remote-init")"
  out=$(run_cmd "$P_REMOTE" init --verbose); ec=$?
  assert_exit_ok "R1-exit" $ec
  assert_file_exists "R1-manifest" "$P_REMOTE/.aidd/manifest.json"
  assert_file_exists "R1-docs" "$P_REMOTE/aidd_docs"
else
  echo -e "  ${YELLOW}⊘ SKIP — pas de token d'auth disponible${RESET}"
  SKIP=$((SKIP + 1))
fi

step "R2" "remote init déjà initialisé — erreur AVANT download"
if [[ $HAVE_TOKEN -eq 1 ]]; then
  out=$(run_cmd "$P_REMOTE" init --verbose); ec=$?
  assert_exit_err "R2-exit" $ec
  assert_contains "R2-error" "$out" "Already initialized"
  assert_not_contains "R2-no-download" "$out" "Downloading"
else
  echo -e "  ${YELLOW}⊘ SKIP — pas de token d'auth disponible${RESET}"
  SKIP=$((SKIP + 1))
fi

step "R3" "remote init avec .claude/ existant — erreur AVANT download"
if [[ $HAVE_TOKEN -eq 1 ]]; then
  P_REMOTE_CLAUDE="$(new_project "remote-claude-exists")"
  mkdir -p "$P_REMOTE_CLAUDE/.claude"
  out=$(run_cmd "$P_REMOTE_CLAUDE" init --verbose); ec=$?
  assert_exit_err "R3-exit" $ec
  assert_contains "R3-error" "$out" "aidd adopt"
  assert_not_contains "R3-no-download" "$out" "Downloading"
else
  echo -e "  ${YELLOW}⊘ SKIP — pas de token d'auth disponible${RESET}"
  SKIP=$((SKIP + 1))
fi

step "R4" "remote init --force sur projet déjà initialisé — réinitialise sans erreur"
if [[ $HAVE_TOKEN -eq 1 ]]; then
  # P_REMOTE was already initialized in R1; --force should re-run successfully
  out=$(run_cmd "$P_REMOTE" init --force --verbose); ec=$?
  assert_exit_ok "R4-exit" $ec
  assert_contains "R4-initialized" "$out" "Initialized"
  assert_file_exists "R4-manifest" "$P_REMOTE/.aidd/manifest.json"
else
  echo -e "  ${YELLOW}⊘ SKIP — pas de token d'auth disponible${RESET}"
  SKIP=$((SKIP + 1))
fi

# ─────────────────────────────────────────────
summary
