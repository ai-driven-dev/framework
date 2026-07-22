# CLI v5+ Issues Plan — Existing Backlog + New Issues

> Generated 2026-05-14. Pairs with `2026_05_14-cli-v5-roadmap.md` and `2026_05_13-cli-post-marketplace-challenge.md`.

---

## Mission framing (recap)

**Core (sole purpose):** dual-mode translator framework → target tool format
- **Mode A — Marketplace + plugins** : Claude, Copilot VSCode, Codex (native marketplace support)
- **Mode B — Flat materialization** : OpenCode, Cursor (no marketplace config mechanism)

**Secondary:** configuration helper (settings.json opinionated per tool)

**Tertiary:** layers (diffusion, DX, enterprise, tracking, workspace, etc.)

---

## Tool × Mode matrix

| Tool | Mode | Target config / location | Config helper present |
|---|---|---|---|
| Claude | A | `.claude/settings.json` `extraKnownMarketplaces` + `enabledPlugins` (project) or `~/.claude/settings.json` (user) | settings.json polish |
| Copilot VSCode | A | `.github/copilot/settings.json` (project only — CLI can't write VSCode default profile) | `.vscode/settings.json` Copilot tweaks (if vscode also installed) |
| Codex | A | `.agents/plugins/marketplace.json` (project) or `~/.agents/plugins/marketplace.json` (user) | config.toml polish |
| OpenCode | B | `.opencode/plugins/<name>/` (project) or `~/.config/opencode/plugins/<name>/` (user) | `opencode.json` polish |
| Cursor | B (default) / A (opt-in, pending validation) | Mode B: `~/.cursor/plugins/local/<name>/` (user). Mode A: workspace `.cursor-plugin/marketplace.json` if Cursor reads it. | (no settings polish — UI-managed) |
| vscode (IDE) | n/a | `.vscode/{settings,keybindings,extensions}.json` | settings.json polish (config helper only, no marketplace concept) |

**Implementation implication:** Mode A vs B drives different adapter code paths in `marketplace add` / `plugin install` / `sync` use-cases. Already present (Mode A = `MarketplaceSyncSettingsUseCase`, Mode B = flat plugin materialization). Need explicit naming + tests per mode.

---

## Audit summary

**Quality baseline (current state):**
- 161 commits ahead main on `feat/plugin-architecture`
- 1399 tests passing, 0 skip
- Test pyramid: 97 unit / 22 integration / 11 e2e (inverted ✓)
- Bundle 480 KB (within 500 KB budget)
- 0 TODO/FIXME in src
- 0 domain → app/infra violations (hexagonal clean)
- 1 biome warning (cosmetic, unused `_logger`)
- 1 knip false positive (`marketplace-entry.ts`)
- 1 method size warning (`InstallRuntimeConfigUseCase.execute` 24 lines, target ≤20)
- 68 jscpd clones flagged (low severity, no actionable items surfaced)

**Conclusion:** strong foundation. Phase 1 MVP feasible without refactor.

---

## Existing GitHub issues — mapped to roadmap

### Already done in v5 (CLOSE)

- **#146** feat: manifest v2 — structure tool-first avec plugin tracking → ✅ Done (manifest v6)
- **#147** feat: framework loader — téléchargement + extraction plugin-aware → ✅ Done
- **#148** feat: aidd plugin — sous-groupe commandes → ✅ Done (will refactor)
- **#152** feat: native plugin install Claude/Cursor/Copilot → ✅ Done
- **#153** feat: plugin manifest adapter → ✅ Done

### Phase 1 MVP (refactor/finalize)

- **#149** feat: install wizard — sélection interactive plugins → Phase 1 (wizard push)
- **#150** feat: commandes read-only plugin-aware (status, doctor) → Phase 1
- **#151** feat: commandes write plugin-aware (restore, sync, uninstall) → Phase 1
- **#161** [bug] typo: --ai → Phase 1 polish
- **#165** [bug] update_memory CLAUDE.md path → Phase 1 polish

### Phase 2 — Diffusion maximale

- **#76** feat: aidd completions (shell autocomplete) → Phase 2

### Phase 3 — Plugin author DX

- **#77** feat: aidd lint (validation files) → Phase 3

### Phase 4 — Tracking & audit

- **#20** feat: user files lifecycle management → Phase 4
- **#75** feat: aidd preview (dry-run global) → Phase 4
- **#78** feat: aidd diff (compare versions framework) → Phase 4

### Phase 5 — Tool coverage extension

- **#68** Windsurf support → Phase 5
- **#69** Roo-Code/Cline support → Phase 5
- **#70** Kiro AWS support → Phase 5
- **#71** Amazon Q Developer support → Phase 5
- **#85** Antigravity support → Phase 5
- **#89** Gemini CLI support → Phase 5
- **#140** Codex CLI support → partial done; revisit Phase 5 for completion

### Phase 7 — Workspace multi-project

- **#21** mono-repo / multi-repo management → Phase 7

### Uncategorized / re-evaluate

- **#22** git guardrails init → re-evaluate (Phase 1 polish ? framework-side?)
- **#81** GitLab VCS provider → re-evaluate (Phase 2 ? framework-side?)

---

## New issues to create

### Phase 1 — Drops (8 issues)

1. **chore: drop `marketplace browse` — fold into `list --plugins`**
2. **chore: drop `marketplace cache list/clear` — fold into `refresh --force`**
3. **chore: drop `plugin add` — fuse into `install`**
4. **chore: drop `plugin pick` — fuse into `install` no-args interactive**
5. **chore: drop `plugin status` — use `status` global**
6. **chore: drop `plugin sync` — use `ai sync`**
7. **chore: drop `plugin restore` — use `ai restore`**
8. **chore: fix knip false positive `marketplace-entry.ts`**

### Phase 1 — Quality polish (3 issues)

9. **chore: split `InstallRuntimeConfigUseCase.execute` (24 lines → ≤20)**
10. **chore: silence biome warning unused `_logger` (rename or remove)**
11. **chore: audit jscpd 68 clones, extract shared helpers where useful**

### Phase 1 — New features (1 issue)

12. **feat: add `ide restore [files...]` command (symmetry with `ai restore`)**

### Phase 1 — Translator dual-mode formalization (5 issues)

This block formalizes the CORE mission. Code partially exists; needs explicit naming + per-mode tests + docs.

13a. **refactor: name translator adapters explicitly per mode (`ModeAMarketplaceAdapter`, `ModeBFlatMaterializationAdapter`)** — replace implicit branching with named adapters; document each mode contract
13b. **test: per-mode integration suite — Mode A for Claude/Copilot/Codex, Mode B for OpenCode/Cursor — assert each tool produces expected output structure**
13c. **docs: translator dual-mode reference doc (which tool uses which mode, why, how to add a new tool)**
13d. **feat: Cursor Mode B implementation `~/.cursor/plugins/local/<name>/` flat materialization (default)**
13e. **feat: tool capability declaration of preferred mode (`translationMode: "marketplace" | "flat"` in tool definition)**
13f. **investigate: does Cursor read workspace `.cursor-plugin/marketplace.json` at project root?** — manual test, document finding (gates 13g implementation)
13g. **feat: Cursor Mode A opt-in workspace marketplace via `.cursor-plugin/marketplace.json`** — pending 13f result, with `--cursor-mode <marketplace|flat>` flag or auto-detection

### Phase 1 — Cross-cutting (7 issues)

14. **feat: `--scope user|project` flag across install/marketplace add (matrix per tool)**
15. **feat: pre-register `aidd-framework` default marketplace at setup**
16. **feat: migration auto-prompt on CLI entry (TTY) + non-TTY exit hint**
17. **feat: setup wizard multi-step + project context detection + smart recommendations**
18. **chore: Copilot user-level warning (CLI cannot write VSCode default profile)**
19. **refactor: setup flags simplification (10 → 6 — unified `--plugins`, drop `--all`)**
20. **feat: configuration helper formalization — opinionated settings.json proposals per tool, opt-in/opt-out flag**

### Phase 1 — Framework-side (2 issues, framework repo)

21. **(framework) make `aidd-framework` repo public**
22. **(framework) ship `.cursor-plugin/marketplace.json` alongside `.claude-plugin/marketplace.json`**

### Phase 1 — Release & migration (3 issues)

23. **release: cut v5.0.0-rc.1 when Phase 1 scope complete**
24. **release: cut v5.0.0 stable open-source launch**
25. **chore: migrate `aidd-cli` repo into `aidd-framework/cli/` monorepo (post-MVP)**

### Phase 2 — Diffusion maximale

25. **feat: `npx @ai-driven-dev/cli` zero-install verified**
26. **feat: one-liner install script `curl install.sh | sh`**
27. **feat: GitHub Action `ai-driven-dev/setup-aidd@v1`**
28. **feat: Docker image with framework pre-installed**
29. **feat: docs portal aidd.dev**
30. **feat: opt-in telemetry (privacy-respecting)**

### Phase 3 — Plugin author DX

31. **feat: `aidd plugin scaffold <name>` template generator**
32. **feat: `aidd plugin test <path>` sandboxed test runner**
33. **feat: `aidd marketplace create <name>` bootstrap custom marketplace**
34. **feat: `aidd marketplace publish` workflow**
35. **docs: plugin author guide + starter template repo**

### Phase 4 — Tracking & audit

36. **feat: `aidd history` timeline installs/updates/uninstalls**
37. **feat: manifest snapshots `.aidd/snapshots/` with save/restore**
38. **feat: export rapport état projet (JSON/Markdown)**
39. **feat: drift detection trend over time**

### Phase 6 — Enterprise / Trust

40. **feat: plugin signature verification (Sigstore or Ed25519)**
41. **feat: plugin permission model + sandbox execution**
42. **feat: compatibility matrix framework × tool versions**
43. **feat: private marketplace hosting**
44. **feat: multi-tenant config `--org` `--team`**
45. **feat: centralized policies via managed settings**
46. **feat: compliance/audit log streaming**
47. **feat: SSO/SAML for private marketplaces**
48. **feat: rollout management (canary, staged release)**

### Phase 7 — Workspace

49. **feat: `aidd workspace init` define workspace root**
50. **feat: `aidd workspace sync` cross-project propagation**
51. **feat: shared config inheritance (workspace → project)**
52. **feat: `aidd workspace upgrade` atomic framework upgrade across projects**
53. **feat: cross-project status dashboard**

---

## Issues actions summary

| Action | Count | Notes |
|---|---|---|
| CLOSE (done in v5) | 5 | #146, #147, #148, #152, #153 |
| KEEP, label Phase 1 | 5 | #149, #150, #151, #161, #165 |
| KEEP, label Phase 2-7 | 13 | tools support, lint, diff, completions, etc |
| RE-EVALUATE | 2 | #22 (guardrails), #81 (GitLab) |
| NEW Phase 1 | 30 | drops (8) + quality (3) + features (1 ide restore) + translator dual-mode (7 — incl. Cursor Mode A investigate + opt-in) + cross-cutting (7) + framework (2) + release (3) |
| NEW Phase 2 | 6 | diffusion |
| NEW Phase 3 | 5 | DX plugin author |
| NEW Phase 4 | 4 | tracking |
| NEW Phase 6 | 9 | enterprise |
| NEW Phase 7 | 5 | workspace |
| **Total new** | **59** | (30 Phase 1 + 6 Phase 2 + 5 Phase 3 + 4 Phase 4 + 9 Phase 6 + 5 Phase 7) |
| **Existing kept** | **18** | |
| **Total backlog** | **77** | |

---

## Labels strategy (GitHub)

Add labels:
- `phase:1` … `phase:7` (priority phase)
- `type:drop`, `type:enhancement`, `type:bug`, `type:chore`, `type:docs`, `type:release`
- `area:cli`, `area:framework`, `area:docs`, `area:ci`
- `mvp` (Phase 1 must-have)
- `good-first-issue` (community-friendly)
- `breaking-change` (semver impact)

---

## Implementation order recommendation

**Phase 1 attack sequence (core-first):**

1. **Translator dual-mode formalization** — name adapters Mode A/B, per-mode tests, docs, tool capability declaration. Core mission must be rock-solid first.
2. **Cursor Mode B implementation** — `~/.cursor/plugins/local/<name>/` flat materialization adapter
3. **Configuration helper formalization** — opt-in/out, opinionated settings.json per tool, clean separation from translator
4. **Drops (cheap, clear wins)** — 8 issues, days of work
5. **Cross-cutting flags & wizard** — `--scope`, `--plugins` simplification, setup wizard
6. **New `ide restore`** — small symmetric work
7. **Migration auto-prompt** — single use-case
8. **Quality polish** — knip fix, method size, biome warning
9. **Framework public + cursor marketplace.json** — coordination framework team
10. **v5.0.0-rc.1 cut → testing**
11. **v5.0.0 stable launch**
12. **Repo monorepo migration** (post-stable)

**Phase 2 attack post-launch:**
- `npx` verification first (zero work if already works)
- Docs portal + telemetry (highest leverage for adoption)
- Then GH Action, Docker, install script

---

## Open questions

1. Confirm CLOSE list (5 issues already done) — re-validate each before closing
2. Confirm RE-EVALUATE list (#22 guardrails, #81 GitLab) — phase assignment?
3. Confirm NEW issues count manageable — break further?
4. Sub-issues vs epics for Phase 6 (enterprise) — split into smaller deliverables?
5. Framework team coordination — who owns #20, #21 framework changes?
