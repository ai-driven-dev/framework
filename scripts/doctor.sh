#!/usr/bin/env bash
# aidd-framework doctor
#
# Diagnostic preflight for users (install the marketplace) and contributors
# (work on the marketplace). Prints OK / WARN / FAIL per check and a final
# verdict.

set -uo pipefail

ok()   { printf "  \033[32mOK\033[0m   %s\n" "$1"; }
warn() { printf "  \033[33mWARN\033[0m %s\n" "$1"; FAIL=$((FAIL + 0)); }
fail() { printf "  \033[31mFAIL\033[0m %s\n" "$1"; FAIL=$((FAIL + 1)); }

FAIL=0
MODE="${1:-all}"   # all | user | contributor

print_section() { printf "\n\033[1m%s\033[0m\n" "$1"; }

# --- user-mode checks --------------------------------------------------------

if [ "$MODE" = "all" ] || [ "$MODE" = "user" ]; then
  print_section "Claude Code"
  if command -v claude >/dev/null 2>&1; then
    ver=$(claude --version 2>/dev/null | head -1 || echo "?")
    ok "claude CLI present ($ver)"
  else
    fail "claude CLI not found (https://docs.anthropic.com/en/docs/claude-code/installation)"
  fi

  print_section "GitHub CLI"
  if command -v gh >/dev/null 2>&1; then
    ok "gh CLI present ($(gh --version | head -1))"
    if gh auth status >/dev/null 2>&1; then
      ok "gh authenticated"
    else
      warn "gh not authenticated (run: gh auth login)"
    fi
  else
    warn "gh CLI not found (https://cli.github.com/) - required for plugins that interact with GitHub"
  fi

  print_section "Network"
  if curl -sf -o /dev/null --max-time 5 https://api.github.com; then
    ok "github.com reachable"
  else
    fail "github.com unreachable"
  fi
  if curl -sf -o /dev/null --max-time 5 https://api.anthropic.com; then
    ok "api.anthropic.com reachable"
  else
    warn "api.anthropic.com unreachable (Claude calls will fail)"
  fi
fi

# --- contributor-mode checks -------------------------------------------------

if [ "$MODE" = "all" ] || [ "$MODE" = "contributor" ]; then
  print_section "Node + pnpm"
  if command -v node >/dev/null 2>&1; then
    nv=$(node --version | tr -d 'v')
    nv_major=${nv%%.*}
    if [ "$nv_major" -ge 20 ]; then
      ok "node v$nv (>= 20)"
    else
      fail "node v$nv (need >= 20)"
    fi
  else
    fail "node not found (https://nodejs.org/)"
  fi
  if command -v pnpm >/dev/null 2>&1; then
    ok "pnpm $(pnpm --version)"
  else
    fail "pnpm not found (https://pnpm.io/installation)"
  fi

  print_section "Hook tooling"
  if command -v jq >/dev/null 2>&1; then
    ok "jq $(jq --version)"
  else
    fail "jq not found (brew install jq) - required by the json-validity hook"
  fi
  if command -v python3 >/dev/null 2>&1; then
    ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
  else
    warn "python3 not found - yaml-validity hook will skip"
  fi
  if command -v pipx >/dev/null 2>&1; then
    ok "pipx $(pipx --version)"
  else
    warn "pipx not found (brew install pipx) - JSON schema validation will be skipped"
  fi
  if [ -f lefthook.yml ]; then
    if pnpm exec lefthook version >/dev/null 2>&1; then
      ok "lefthook installed via pnpm"
    else
      warn "lefthook not installed (run: pnpm install)"
    fi
  fi
fi

# --- verdict ----------------------------------------------------------------

print_section "Verdict"
if [ "$FAIL" -eq 0 ]; then
  printf "  \033[32mAll critical checks passed.\033[0m\n"
  exit 0
else
  printf "  \033[31m%d critical check(s) failed.\033[0m See lines marked FAIL above.\n" "$FAIL"
  exit 1
fi
