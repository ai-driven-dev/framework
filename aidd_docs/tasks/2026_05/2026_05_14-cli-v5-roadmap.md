# CLI v5+ Roadmap — Open-Source Strategy

> Generated 2026-05-14 from brainstorm follow-up.
> Builds on `2026_05_13-cli-post-marketplace-challenge.md` (command verdicts).

---

## Vision

### Core mission (sole purpose)

**AIDD CLI = framework-to-tool TRANSLATOR with two modes.**

The framework lives as a marketplace (plugins + agents + skills + commands). Each AI/IDE tool has its own native format, conventions, and install path. The CLI's primary job is to translate the framework into every target tool's native format, choosing the right mode per tool:

**Mode A — Marketplace + plugins (preferred when supported):**
- Tools with native marketplace mechanism (Claude, Copilot VSCode, Codex)
- CLI registers the framework marketplace in the tool's config file using its native schema
- Plugins remain as plugins inside the marketplace, fetched/enabled by the tool itself
- Preserves plugin update path, version pinning, tool's native UX

**Mode B — Flat materialization (when no marketplace support):**
- Tools without marketplace config mechanism (OpenCode, Cursor)
- CLI materializes plugin content directly into the tool's plugin directory
- Plugins are unpacked as files into `.opencode/plugins/<name>/` or `~/.cursor/plugins/local/<name>/`
- Loses native plugin lifecycle but works where no marketplace exists

The mode is **tool-determined, not user-chosen** (the CLI knows which mode each tool requires). This dual-mode translation is the heart of the CLI. Everything else is a layer on top.

### Secondary mission

**Tool configuration helper.** Beyond framework translation, the CLI proposes opinionated `settings.json` (and equivalent) configurations per tool to optimize the user's environment for AI-Driven Development (Copilot tweaks, autoApprove rules, accessibility signals, agent-related settings, etc.).

### Tertiary missions (layered on top)

Built on the translation + configuration foundation:
1. **Open source forever** — CLI + framework both
2. **Maximum diffusion** — lowest friction install, every entry point covered
3. **Universal tool coverage** — native marketplace tools + non-native adapters
4. **Enterprise-grade trust** — signed plugins, policies, audit, SSO, rollout
5. **Plugin author DX** — scaffold, lint, test, publish workflows
6. **Tracking & audit** — manifest as source of truth, history, diff, drift detection
7. **Multi-project workspaces** — team-wide config inheritance, cross-project sync
8. **Quality > quantity** — every command/feature challenged against the value pillars

### Mental model

```
Framework Marketplace (plugins + agents + skills + commands)
                    │
                    ▼
        ┌───────────────────────────┐
        │  AIDD CLI                 │
        │  • Translator (dual-mode) │ ← Core
        │      Mode A: Marketplace  │
        │      Mode B: Flat         │
        │  • Configuration helper   │ ← Secondary
        │  • Layers (diffusion, DX, │
        │    enterprise, …)         │ ← Tertiary
        └───────────────────────────┘
                    │
   ┌────────────────┼────────────────┐
   ▼                ▼                ▼
 Mode A          Mode A           Mode B
 (marketplace)   (marketplace)    (flat)
 Claude          Copilot          OpenCode
 Codex                            Cursor
                                  + future tools without marketplace
```

---

## Repo migration

**Decision:** migrate `aidd-cli` repo INTO `aidd-framework` as a sub-application.

**Rationale:**
- Framework + CLI evolve in lockstep
- Single source of truth for releases (one tag covers both)
- Easier contributor onboarding (one repo to clone)
- Monorepo enables shared tooling (biome, lefthook, CI)

**Migration plan:**
1. Inventory current `aidd-cli` (PRs open, issues, releases, npm package)
2. Create `aidd-framework/cli/` directory in framework repo
3. Transfer git history (`git-filter-repo` or `subtree`) to preserve commits
4. Update CI/CD pipelines for monorepo (Turborepo / pnpm workspaces / nx)
5. Update npm publishing flow (still `@ai-driven-dev/cli` but built from `cli/` subdir)
6. Open issues migration (label `cli:` prefix)
7. Archive `aidd-cli` repo with pointer to monorepo
8. Update docs/readme references

**Timing:** post-MVP, after current branch (`feat/plugin-architecture`) merges to main.

---

## 8 Axes — full prioritization

### Phase 0 — Stabilize current branch (DONE)
- 14 commands locked (see 2026_05_13 doc)
- Cross-cutting actions identified
- Drop list known
- Framework public (pending repo visibility flip)

### Phase 1 — MVP (open-source launch ready)

Goal: ship a CLI that fulfills the universal installer promise across all 5 tools, with clean DX. Open-source release worthy.

**Scope:**
- [ ] All 14 commands implemented per verdict (see 2026_05_13 doc)
- [ ] Cross-cutting actions:
  - [ ] `--scope user|project` flag matrix
  - [ ] Pre-register aidd-framework default marketplace
  - [ ] Migration auto-prompt on entry
  - [ ] Setup wizard multi-step + context detection
  - [ ] Cursor user-level materialization
  - [ ] Copilot user-level warning (CLI can't write VSCode default profile)
  - [ ] Setup flags simplification (10 → 6)
  - [ ] `ide restore` symmetry
- [ ] Drop list applied (see 2026_05_13 doc)
- [ ] Framework repo public
- [ ] `aidd-framework` ships `.cursor-plugin/marketplace.json` in addition to `.claude-plugin/marketplace.json`
- [ ] Repo migration cli → framework monorepo
- [ ] CHANGELOG + MIGRATION docs aligned
- [ ] Stable release `v5.0.0`

**Out of scope MVP:** axes D (enterprise), E (signature/sandbox), F (plugin author DX), G (history/diff), H (workspace)

### Phase 2 — Diffusion maximale (axis A)

Goal: lower friction so install is trivial, increase adoption.

**Scope:**
- [ ] `npx @ai-driven-dev/cli` zero-install entry (verify works)
- [ ] One-liner install script (`curl https://aidd.dev/install.sh | sh`) with security review
- [ ] GitHub Action template (`uses: ai-driven-dev/setup-aidd@v1`)
- [ ] Docker image with framework pre-installed (for CI/dev containers)
- [ ] Documentation portal (aidd.dev) with copy-paste install commands per platform
- [ ] Telemetry (opt-in) to measure adoption: installs/month, retention, multi-tool ratio
- [ ] Marketing collateral (blog post, demo video, README polish)

### Phase 3 — Plugin author DX (axis F)

Goal: enable ecosystem growth via 3rd-party plugins.

**Scope:**
- [ ] `aidd plugin scaffold <name>` template generator (interactive, framework-aware)
- [ ] `aidd plugin lint <path>` schema validator (catch malformed plugins before publish)
- [ ] `aidd plugin test <path>` test runner (run plugin in sandboxed env, assert behavior)
- [ ] `aidd marketplace create <name>` bootstrap custom marketplace repo structure
- [ ] `aidd marketplace publish` workflow (push to GitHub, tag release)
- [ ] Plugin author docs (how to build, test, publish)
- [ ] Plugin starter template repo (aidd-plugin-template)

### Phase 4 — Tracking & audit (axis G)

Goal: rich history of project state over time.

**Scope:**
- [ ] `aidd history` timeline of installs/updates/uninstalls per project
- [ ] `aidd diff <from-version> <to-version>` show changes between framework versions
- [ ] Manifest snapshots (`.aidd/snapshots/`)
- [ ] `aidd snapshot save <name>` / `aidd snapshot restore <name>` rollback workflows
- [ ] Export rapport état projet (JSON/Markdown) for compliance
- [ ] Drift detection trend (changes over time, not just instantaneous)

### Phase 5 — Tool coverage extension (axis C)

Goal: support every major AI/IDE tool, position CLI as universal adapter.

**Scope (per tool):**
- [ ] JetBrains (IDEA, PyCharm, WebStorm, etc.) — common settings.json equivalents
- [ ] Sublime Text — packages + settings
- [ ] Neovim — plugins via lazy.nvim / packer / native
- [ ] Zed — extension format
- [ ] Helix — configs
- [ ] Emacs — packages.el
- [ ] Document plugin tool abstraction for community contributions

### Phase 6 — Enterprise (axis D + E)

Goal: org/team adoption with trust, governance, scale.

**Scope:**

#### Trust & Quality (axis E)
- [ ] Plugin signature verification (Ed25519 or Sigstore)
- [ ] Hash check before install (SHA-256 vs marketplace catalog)
- [ ] Permission model (plugin declares resources accessed)
- [ ] Sandbox execution (limit fs/network access per plugin)
- [ ] Compatibility matrix (framework v X × tool v Y) with warnings

#### Org features (axis D)
- [ ] Private marketplace hosting (self-host framework instance)
- [ ] Multi-tenant config (`aidd setup --org <name> --team <name>`)
- [ ] Centralized policies (admin force plugins enabled/blocked via managed settings)
- [ ] Compliance/audit logs (install events streamed to org log endpoint)
- [ ] SSO/SAML auth for private marketplaces
- [ ] Rollout management (staged release framework versions across team — canary/full)
- [ ] License management hooks (if plugins commercial future)

### Phase 7 — Workspace / multi-project (axis H)

Goal: org-wide project management.

**Scope:**
- [ ] `aidd workspace init` define workspace root
- [ ] `aidd workspace list` show all projects under workspace
- [ ] `aidd workspace sync` propagate plugins/config across all projects
- [ ] Shared config inheritance (workspace defaults → project overrides)
- [ ] `aidd workspace upgrade` upgrade framework across all projects atomically
- [ ] Cross-project status dashboard (drift detection, version skew)

---

## MVP definition (Phase 1) — locked

**Acceptance criteria:**
- Every install command (CLI + tools combinations) works end-to-end for all 5 AI tools + vscode
- Setup wizard guides any user through first install <5 minutes
- Re-run on existing project gracefully adapts (no destructive surprises)
- Sync propagates changes across tools deterministically
- Update refreshes assets without touching user config
- Open-source license file + contributor guide + code of conduct
- v5.0.0 published to npm + GitHub release
- aidd-framework repo public, ships both `.claude-plugin/marketplace.json` and `.cursor-plugin/marketplace.json`

**Effort estimate:** 2-4 weeks dedicated.

---

## Backlog cleanup

**Action:** audit existing GitHub issues in `ai-driven-dev/aidd-cli` repo:

1. **Migration prep:**
   - Label existing issues with target phase (`phase-1` … `phase-7`)
   - Close obsolete issues (related to old marketplace mechanisms now dropped)
   - Re-write issue descriptions to match new vision

2. **New issues to create:**
   - One issue per locked command verdict (track impl progress)
   - One issue per cross-cutting action
   - One issue per drop (cleanup work)
   - Phase 2-7 epics (parent issues with breakdown)

3. **Roadmap visibility:**
   - GitHub Project board: phases as columns, issues as cards
   - Public-facing roadmap (aidd.dev/roadmap)

---

## Open questions for next session

1. **Repo migration timing:** before or after Phase 1 MVP? Recommend AFTER MVP (less churn during stabilization).
2. **Monorepo tooling:** Turborepo / pnpm workspaces / nx — preference?
3. **Documentation portal:** existing aidd.dev? Or new docs site (Docusaurus/Astro)?
4. **Telemetry vendor:** PostHog / Plausible / self-hosted? Privacy stance?
5. **Plugin signature scheme:** Sigstore (industry standard) or custom Ed25519?
6. **Open-source license:** MIT / Apache 2.0 / dual?
7. **Funding model long-term:** GitHub Sponsors / Open Collective / corporate sponsorship / agnostic?
8. **First phase to attack post-MVP:** A (diffusion), F (plugin author DX), or G (tracking)? Each unlocks different growth dynamic.

---

## Next concrete steps

1. **Confirm this roadmap** with user (this doc as living source of truth)
2. **Inventory current `aidd-cli` issues** (gh issue list → categorize)
3. **Apply 2026_05_13 verdicts** in code (implement drops + cross-cutting actions)
4. **Plan repo migration** (separate doc detailing git history transfer + CI changes)
5. **Cut v5.0.0-rc.1** when Phase 1 scope complete
6. **Launch open-source** with v5.0.0 stable
7. **Pick Phase 2 axis** and start
