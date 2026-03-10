#!/usr/bin/env bash

CLI="/Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/dist/cli.js"
FW="/Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli/tests/fixtures/framework"
FW_OPT="--framework $FW"

PASS=0
FAIL=0
SKIP=0

ALL_TMPDIRS=()

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$SCRIPT_DIR/projects"
mkdir -p "$RUN_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

cleanup() {
  echo ""
  echo -e "${YELLOW}Projets conservés dans : $RUN_DIR${RESET}"
  echo -e "${YELLOW}Suppression manuelle : rm -rf $RUN_DIR${RESET}"
}
trap cleanup EXIT

new_project() {
  local name="$1"
  local dir="$RUN_DIR/$name"
  rm -rf "$dir"
  mkdir -p "$dir"
  ALL_TMPDIRS+=("$dir")
  echo -e "  ${YELLOW}Dossier projet : $dir${RESET}" >&2
  echo "$dir"
}

step() {
  local num="$1" desc="$2" expect="$3"
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}[${num}] ${desc}${RESET}"
  echo -e "${YELLOW}Attendu : ${expect}${RESET}"
  echo ""
}

ask() {
  echo ""
  printf "${BOLD}[Enter=PASS / f=FAIL / s=SKIP] > ${RESET}"
  read -r answer
  case "$answer" in
    f|F) echo -e "${RED}✗ FAIL${RESET}"; FAIL=$((FAIL + 1)) ;;
    s|S) echo -e "${YELLOW}⊘ SKIP${RESET}"; SKIP=$((SKIP + 1)) ;;
    *)   echo -e "${GREEN}✓ PASS${RESET}"; PASS=$((PASS + 1)) ;;
  esac
}

run_cmd() {
  local dir="$1"; shift
  echo -e "${CYAN}\$ node dist/cli.js $*${RESET}"
  echo ""
  (cd "$dir" && node "$CLI" "$@") || true
}

silent_cmd() {
  local dir="$1"; shift
  (cd "$dir" && node "$CLI" "$@") > /dev/null 2>&1 || true
}

summary() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}RÉSUMÉ${RESET}"
  echo -e "${GREEN}  PASS : $PASS${RESET}"
  echo -e "${RED}  FAIL : $FAIL${RESET}"
  echo -e "${YELLOW}  SKIP : $SKIP${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        AIDD CLI — Test interactif complet                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "CLI     : $CLI"
echo -e "FIXTURE : $FW"
echo ""
echo -e "${YELLOW}Enter = PASS | f = FAIL | s = SKIP${RESET}"

# ─────────────────────────────────────────────
# Projets réutilisés
# ─────────────────────────────────────────────
P="$(new_project "main")"          # projet principal (initialisé + tous outils)
P_EMPTY="$(new_project "empty")"   # projet jamais initialisé

# ─────────────────────────────────────────────
# INIT
# ─────────────────────────────────────────────
step "01" "init — premier init dans un projet vide" \
  "Crée .aidd/manifest.json + dossier aidd_docs/"
run_cmd "$P" init $FW_OPT --verbose
ask

step "02" "init --force — ré-init dans un projet déjà initialisé" \
  "Réinitialise sans erreur"
run_cmd "$P" init $FW_OPT --force --verbose
ask

step "03" "init dans un projet non initialisé (sans réseau/cache)" \
  "Erreur claire si pas de réseau/cache disponible, sinon init OK"
P_OFFLINE="$(new_project "offline")"
run_cmd "$P_OFFLINE" init --verbose
ask

step "04" "init --repo — persiste le repo custom dans le manifest" \
  "manifest.repo = my-org/custom-framework visible via config get repo"
P_REPO="$(new_project "custom-repo")"
run_cmd "$P_REPO" init $FW_OPT --repo my-org/custom-framework
run_cmd "$P_REPO" config get repo
ask

step "05" "init dans un projet déjà initialisé (sans --force)" \
  "Erreur : 'Already initialized. Use aidd init --force'"
P_ALREADY="$(new_project "already-init")"
silent_cmd "$P_ALREADY" init $FW_OPT
run_cmd "$P_ALREADY" init $FW_OPT
ask

# ─────────────────────────────────────────────
# INSTALL
# ─────────────────────────────────────────────
step "06" "install claude" \
  "Crée .claude/ et met à jour le manifest"
run_cmd "$P" install claude $FW_OPT --verbose
ask

step "07" "install cursor" \
  "Crée .cursor/ dans le projet"
run_cmd "$P" install cursor $FW_OPT --verbose
ask

step "08" "install copilot" \
  "Crée les fichiers copilot"
run_cmd "$P" install copilot $FW_OPT --verbose
ask

step "09" "install outil déjà installé (sans --force)" \
  "Message 'already installed' ou skip propre"
run_cmd "$P" install claude $FW_OPT --verbose
ask

step "10" "install outil déjà installé avec --force" \
  "Réinstalle sans erreur"
run_cmd "$P" install claude $FW_OPT --force --verbose
ask

step "11" "install dans un projet non initialisé" \
  "Erreur : 'No AIDD installation found. Run aidd init first.'"
run_cmd "$P_EMPTY" install claude $FW_OPT --verbose
ask

step "12" "install --all — installe tous les outils" \
  "claude + cursor + copilot installés"
P_ALL="$(new_project "all-tools")"
silent_cmd "$P_ALL" init $FW_OPT
run_cmd "$P_ALL" install --all $FW_OPT --verbose
ask

# ─────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────
step "13" "status — tous les outils installés" \
  "Liste claude/cursor/copilot avec statut"
run_cmd "$P" status $FW_OPT
ask

step "14" "status dans un projet non initialisé" \
  "Erreur : pas de manifest trouvé"
run_cmd "$P_EMPTY" status $FW_OPT
ask

step "15" "status --tool claude — filtre par outil" \
  "Affiche uniquement les fichiers claude"
run_cmd "$P" status --tool claude $FW_OPT
ask

# ─────────────────────────────────────────────
# DOCTOR
# ─────────────────────────────────────────────
step "16" "doctor — projet sain" \
  "healthy: true, aucune issue"
run_cmd "$P" doctor $FW_OPT
ask

step "17" "doctor — projet non initialisé" \
  "Erreur : 'No AIDD installation found'"
run_cmd "$P_EMPTY" doctor $FW_OPT
ask

step "18" "doctor — dossier docs manquant sur disque" \
  "Issue error: 'Docs directory does not exist on disk'"
rm -rf "$P/aidd_docs"
run_cmd "$P" doctor $FW_OPT
# Restauration silencieuse
silent_cmd "$P" init $FW_OPT --force
silent_cmd "$P" install claude $FW_OPT
silent_cmd "$P" install cursor $FW_OPT
silent_cmd "$P" install copilot $FW_OPT
ask

step "19" "doctor — dossier outil orphelin (présent sur disque, non tracké)" \
  "Issue warning: 'Orphaned directory'"
silent_cmd "$P" uninstall copilot $FW_OPT
mkdir -p "$P/.github"
echo "test" > "$P/.github/copilot-instructions.md"
run_cmd "$P" doctor $FW_OPT
rm -rf "$P/.github"
ask

step "20" "doctor — référence @cassée dans un fichier tracké" \
  "Issue warning: 'Broken reference: @missing/file.md not found on disk'"
TRACKED_MD=$(find "$P/.claude" -name "*.md" | head -1)
if [[ -f "$TRACKED_MD" ]]; then
  echo "See @missing/file.md for details" >> "$TRACKED_MD"
  echo -e "  ${YELLOW}Référence cassée ajoutée dans : $TRACKED_MD${RESET}"
  run_cmd "$P" doctor $FW_OPT
  # restore pour remettre propre
  silent_cmd "$P" restore $FW_OPT --force
else
  echo "  (aucun fichier tracké trouvé)"
fi
ask

step "21" "doctor --fix — restaure les fichiers cassés" \
  "Fichiers restaurés, puis re-check healthy"
silent_cmd "$P" install copilot $FW_OPT
VICTIM_D=$(find "$P/.claude" -name "*.md" | head -1)
if [[ -f "$VICTIM_D" ]]; then
  echo -e "  ${YELLOW}Suppression de : $VICTIM_D${RESET}"
  rm "$VICTIM_D"
fi
run_cmd "$P" doctor $FW_OPT --fix
ask

# ─────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────
silent_cmd "$P" install copilot $FW_OPT

step "22" "update — projet à jour, aucune modification" \
  "Aucun fichier mis à jour"
run_cmd "$P" update $FW_OPT --verbose
ask

step "23" "update — fichier modifié par l'user (conflit → .backup créé)" \
  "Le fichier original est sauvegardé en .backup, nouveau contenu écrit [nécessite AIDD_TOKEN]"
P_UPDATE="$(new_project "update-conflict")"
if [[ -n "$AIDD_TOKEN" ]]; then
  # Install avec une ancienne version puis update vers la dernière
  silent_cmd "$P_UPDATE" init --release v3.4.2
  silent_cmd "$P_UPDATE" install claude --release v3.4.2
  TARGET_U=$(find "$P_UPDATE/.claude" -name "*.md" | head -1)
  if [[ -f "$TARGET_U" ]]; then
    echo "# user modification" >> "$TARGET_U"
    echo -e "  ${YELLOW}Fichier modifié : $TARGET_U${RESET}"
    run_cmd "$P_UPDATE" update --release v3.4.3 --verbose
    echo ""
    echo -e "  ${YELLOW}Fichiers .backup :${RESET}"
    find "$P_UPDATE/.claude" -name "*.backup" 2>/dev/null || echo "  (aucun .backup)"
  fi
else
  echo -e "  ${YELLOW}⊘ AIDD_TOKEN non défini — skip automatique${RESET}"
  echo -e "  ${YELLOW}  Pour tester : export AIDD_TOKEN=<token> puis relancer${RESET}"
  SKIP=$((SKIP + 1))
fi
[[ -z "$AIDD_TOKEN" ]] || ask

step "24" "update --dry-run — simulation sans écriture" \
  "Affiche les changements prévus, aucun fichier modifié"
run_cmd "$P" update $FW_OPT --dry-run --verbose
ask

step "25" "update --force — écrase les conflits sans confirmation" \
  "Pas de prompt, fichiers mis à jour directement"
run_cmd "$P" update $FW_OPT --force --verbose
ask

step "26" "update sans manifest" \
  "Erreur : 'No AIDD installation found'"
run_cmd "$P_EMPTY" update $FW_OPT
ask

# ─────────────────────────────────────────────
# RESTORE
# ─────────────────────────────────────────────

# Remettre le projet dans un état propre
silent_cmd "$P" restore $FW_OPT --force

step "27" "restore — fichier supprimé sur disque, restauré" \
  "Fichier manquant recréé"
VICTIM="$(find "$P/.claude" -name "*.md" | head -1)"
if [[ -f "$VICTIM" ]]; then
  echo -e "  ${YELLOW}Suppression de : $VICTIM${RESET}"
  rm "$VICTIM"
  run_cmd "$P" restore $FW_OPT --force --verbose
  [[ -f "$VICTIM" ]] && echo -e "  ${GREEN}✓ restauré${RESET}" || echo -e "  ${RED}✗ toujours manquant${RESET}"
else
  echo "  (aucun .md dans .claude/)"
fi
ask

step "28" "restore <fichier> — restaure un fichier spécifique (arg positionnel)" \
  "Seul le fichier ciblé est restauré"
VICTIM2="$(find "$P/.claude" -name "*.md" | head -1)"
if [[ -f "$VICTIM2" ]]; then
  REL2="${VICTIM2#$P/}"
  echo "# modified" >> "$VICTIM2"
  echo -e "  ${YELLOW}Fichier modifié : $REL2${RESET}"
  run_cmd "$P" restore "$REL2" $FW_OPT --force --verbose
else
  echo "  (aucun .md dans .claude/)"
fi
ask

step "29" "restore --tool claude — scope à un seul outil" \
  "Seuls les fichiers claude sont restaurés"
run_cmd "$P" restore $FW_OPT --tool claude --force --verbose
ask

step "30" "restore sans --force en mode non-TTY" \
  "Erreur : 'Restore requires --force in non-interactive mode'"
run_cmd "$P" restore $FW_OPT
ask

step "31" "restore sans manifest" \
  "Erreur : 'No AIDD installation found'"
run_cmd "$P_EMPTY" restore $FW_OPT --force
ask

# ─────────────────────────────────────────────
# SYNC
# ─────────────────────────────────────────────
step "32" "sync --source claude --target cursor — modification propagée" \
  "Le contenu modifié dans .claude/ est propagé vers .cursor/"
SYNC_FILE="$(find "$P/.claude" -name "*.md" | head -1)"
if [[ -f "$SYNC_FILE" ]]; then
  echo "# sync test" >> "$SYNC_FILE"
  echo -e "  ${YELLOW}Fichier modifié : ${SYNC_FILE#$P/}${RESET}"
fi
run_cmd "$P" sync --source claude --target cursor $FW_OPT --verbose
ask

step "33" "sync --source claude --target cursor --force — force l'écrasement en cas de conflit" \
  "Propagation forcée sans blocage"
run_cmd "$P" sync --source claude --target cursor $FW_OPT --force --verbose
ask

step "34" "sync --source claude — vers tous les outils (cursor + copilot)" \
  "Propagation vers cursor ET copilot"
run_cmd "$P" sync --source claude $FW_OPT --verbose
ask

step "35" "sync --source claude --target claude — source = cible" \
  "Erreur : source and target cannot be the same"
run_cmd "$P" sync --source claude --target claude $FW_OPT
ask

step "36" "sync vers outil non installé" \
  "Erreur : outil cible non dans le manifest"
P_SINGLE="$(new_project "single-tool")"
silent_cmd "$P_SINGLE" init $FW_OPT
silent_cmd "$P_SINGLE" install claude $FW_OPT
run_cmd "$P_SINGLE" sync --source claude --target cursor $FW_OPT
ask

# ─────────────────────────────────────────────
# UNINSTALL
# ─────────────────────────────────────────────
silent_cmd "$P" install copilot $FW_OPT

step "37" "uninstall copilot" \
  "Fichiers copilot supprimés, entrée retirée du manifest"
run_cmd "$P" uninstall copilot $FW_OPT --verbose
ask

step "38" "uninstall --all — désinstalle tous les outils" \
  "Tous les fichiers outils supprimés"
P_UNINST="$(new_project "uninstall-all")"
silent_cmd "$P_UNINST" init $FW_OPT
silent_cmd "$P_UNINST" install claude $FW_OPT
silent_cmd "$P_UNINST" install cursor $FW_OPT
run_cmd "$P_UNINST" uninstall --all $FW_OPT --verbose
ask

step "39" "uninstall outil non installé" \
  "Erreur ou message indiquant que l'outil n'est pas installé"
run_cmd "$P" uninstall copilot $FW_OPT
ask

# ─────────────────────────────────────────────
# CACHE
# ─────────────────────────────────────────────
step "40" "cache list — liste les versions en cache" \
  "Affiche la liste (peut être vide)"
run_cmd "$P" cache list
ask

step "41" "cache clear <version inexistante>" \
  "Erreur : 'No cached framework found for version 99.99.99'"
run_cmd "$P" cache clear 99.99.99
ask

step "42" "cache clear --all — vide tout le cache" \
  "Tout le cache est supprimé"
run_cmd "$P" cache clear --all
ask

step "43" "cache clear --all <version> — options mutuellement exclusives" \
  "Erreur : cannot specify both a version and --all"
run_cmd "$P" cache clear 1.0.0 --all
ask

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
silent_cmd "$P" install claude $FW_OPT
silent_cmd "$P" install cursor $FW_OPT
silent_cmd "$P" install copilot $FW_OPT

step "44" "config list — affiche docsDir, repo, tools" \
  "docsDir = aidd_docs | repo = ai-driven-dev/aidd-framework | tools = claude, cursor, copilot"
run_cmd "$P" config list
ask

step "45" "config get docsDir" \
  "Affiche la valeur courante : aidd_docs"
run_cmd "$P" config get docsDir
ask

step "46" "config get repo — default si non défini" \
  "Affiche : ai-driven-dev/aidd-framework"
run_cmd "$P" config get repo
ask

step "47" "config get tools — liste des outils installés (read-only)" \
  "Affiche : claude, cursor, copilot"
run_cmd "$P" config get tools
ask

step "48" "config set repo my-org/custom-framework --force" \
  "repo persisté dans le manifest"
run_cmd "$P" config set repo my-org/custom-framework --force
run_cmd "$P" config get repo
ask

step "49" "config set repo format invalide — erreur de validation" \
  "Erreur : Invalid repository format. Expected: owner/repo"
run_cmd "$P" config set repo not-valid-format --force
ask

step "50" "config set repo identique — no-op" \
  "Message : repo is already '...'"
run_cmd "$P" config set repo my-org/custom-framework --force
# reset
run_cmd "$P" config set repo ai-driven-dev/aidd-framework --force
ask

step "51" "config set docsDir my_docs --force (dossier inexistant)" \
  "Warning : dossier inexistant sur disque + move manually | docsDir changé dans manifest"
run_cmd "$P" config set docsDir my_docs --force
run_cmd "$P" config get docsDir
ask

step "52" "config set docsDir aidd_docs --force (dossier existe sur disque)" \
  "Message : Directory found on disk. Updating manifest. | Aucun warning"
run_cmd "$P" config set docsDir aidd_docs --force
run_cmd "$P" config get docsDir
ask

step "53" "config set docsDir sans --force en mode non-TTY" \
  "Erreur : Confirmation required. Use --force to skip in non-interactive mode."
run_cmd "$P" config set docsDir my_docs
ask

step "54" "config set tools — clé read-only" \
  "Erreur : 'tools' is read-only. Use the appropriate aidd command to change it."
run_cmd "$P" config set tools claude,cursor --force
ask

step "55" "config set clé inconnue" \
  "Erreur : Unknown key '...'. Writable keys: docsDir, repo"
run_cmd "$P" config set verbose true --force
ask

step "56" "config sans manifest" \
  "Erreur : 'No AIDD installation found'"
run_cmd "$P_EMPTY" config list
ask

# ─────────────────────────────────────────────
# CLEAN
# ─────────────────────────────────────────────
step "57" "clean (sans --force) — dry-run" \
  "Affiche ce qui serait supprimé, aucun fichier effacé"
P_CLEAN="$(new_project "clean-test")"
silent_cmd "$P_CLEAN" init $FW_OPT
silent_cmd "$P_CLEAN" install claude $FW_OPT
run_cmd "$P_CLEAN" clean --verbose
[[ -d "$P_CLEAN/.aidd" ]] && echo -e "  ${GREEN}✓ .aidd conservé (dry-run)${RESET}" || echo -e "  ${RED}✗ .aidd supprimé (pas censé)${RESET}"
ask

step "58" "clean --force — supprime tout ce qu'aidd a installé" \
  "Fichiers trackés et .aidd/ supprimés"
run_cmd "$P_CLEAN" clean --force --verbose
[[ -d "$P_CLEAN/.aidd" ]] && echo -e "  ${RED}⚠ .aidd encore présent${RESET}" || echo -e "  ${GREEN}✓ .aidd supprimé${RESET}"
ask

step "59" "clean sans manifest" \
  "Message clair ou sortie propre"
run_cmd "$P_EMPTY" clean --force
ask

# ─────────────────────────────────────────────
# OPTIONS GLOBALES
# ─────────────────────────────────────────────
step "60" "aidd --version" \
  "Affiche la version du CLI"
run_cmd "$P" --version
ask

step "61" "aidd --help" \
  "Affiche l'aide générale avec la liste des commandes"
run_cmd "$P" --help
ask

step "62" "aidd init --help" \
  "Affiche les options de la commande init"
run_cmd "$P" init --help
ask

step "63" "aidd config --help" \
  "Affiche les sous-commandes : list, get, set"
run_cmd "$P" config --help
ask

# ─────────────────────────────────────────────
summary
