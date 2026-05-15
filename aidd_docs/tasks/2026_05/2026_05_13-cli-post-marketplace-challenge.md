# CLI Post-Marketplace Challenge — Command-by-Command Review

> Generated from `/aidd:02:brainstorm` session on 2026-05-13.
> Context: AIDD framework is now a native marketplace installable by Claude, Copilot, Cursor, Codex, OpenCode. Re-evaluate CLI value proposition + every command.

---

## Context

- `aidd-framework` will become public (no more private repo blocker for Copilot)
- Native marketplace mechanisms per tool now exist for plugin discovery
- Question: what does the CLI still bring vs N tools reading marketplaces natively?

## Native marketplace matrix per tool

| Tool | Project config path | User-level config path | Scope strategy |
|---|---|---|---|
| Claude | `.claude/settings.json` `extraKnownMarketplaces` | `~/.claude/settings.json` | both writable |
| Copilot VSCode | `.github/copilot/settings.json` `extraKnownMarketplaces` | VSCode default profile (CLI cannot write — `chat.plugins.marketplaces` is application scope) | project writable, user manual |
| Cursor | (no marketplace config file mechanism) | `~/.cursor/plugins/local/` auto-load | user-level only (project not auto-loaded) |
| Codex | `.agents/plugins/marketplace.json` or `.claude-plugin/marketplace.json` | `~/.agents/plugins/marketplace.json` | both writable |
| OpenCode | `.opencode/plugins/` flat | `~/.config/opencode/plugins/` flat | both writable, flat materialization |

## 7 Value Pillars

1. **Translation flat** — tools without marketplace config (OpenCode, Cursor) → CLI materializes plugin content
2. **Multi-tool orchestration** — one command configures N tools; uninstall multi-tool; cross-tool sync; plugin propagation post-setup
3. **Migration interne** — manifest schema v2→v6 transparent
4. **Setup interactif premium** — wizard, context detection, recommendations
5. **Configuration native enrichie** — `.vscode/settings.json` Copilot tweaks via static asset; configs non-marketplace
6. **Tracking projet temporel** — manifest as source of truth; diff; drift detection; audit log; status/doctor/health
7. **Open source** — no monetization

## Target audience

A + B + C (multi-tool teams, solo dev, orgs distributing custom framework)

## Roadmap convergence

- CLI shrinks progressively as native tools converge (≥1 year horizon)
- CLI remains pure orchestrator: interactive setup + multi-tool dispatch + tools without native support
- Open-source forever

---

## Command-by-command verdicts

### 1. `ai`

| Sub | Verdict | Notes |
|---|---|---|
| install | KEEP | Orchestrator with plugin propagation |
| uninstall | KEEP | Cross-tool clean |
| list | KEEP | AI tools installed |
| status | KEEP | Drift detection |
| update [tool] | KEEP | Re-install config from CLI bundled assets (latest CLI version) |
| sync | KEEP | Synchronise cross-tool (marketplace settings + plugin enabled state + flat materialization) |
| restore [files] | KEEP | Revert tool to initial installed version state |
| doctor | KEEP | Scoped doctor variant |

**Sync semantics (locked):**
- Marketplace registry → tools settings.json (`extraKnownMarketplaces` match `.aidd/marketplaces.json`)
- Plugin enabled state cross-tool propagation
- Flat materialization for OpenCode/Cursor
- Does NOT touch bundled config (that's `update`)

**Update semantics (locked):**
- Re-pulls CLI bundled `assets/configs/<tool>/...`
- Overwrites/merges non-marketplace keys in settings files
- Does NOT touch marketplace registry or plugins (that's `sync`)

### 2. `auth`

| Sub | Verdict |
|---|---|
| login | KEEP (private framework orgs) |
| logout | KEEP |
| status | KEEP (debug) |

**Action items:**
- Smart probe: try anonymous public first, fallback to auth only on 404
- Keep project/user scope distinction
- Document org private framework use case

### 3. `clean`

**KEEP** — full project reset
- Removes all manifest-tracked files cross-tool
- Removes `.aidd/`
- Preserves user-owned untracked files
- Distinct from `ai uninstall`/`ide uninstall` (scope-specific)

### 4. `doctor`

| Variant | Verdict |
|---|---|
| `doctor` (global) | KEEP — full health: layout/manifest/AI/IDE/plugins/marketplaces |
| `ai doctor` | KEEP — AI scope |
| `ide doctor` | KEEP — IDE scope |
| `plugin doctor` | KEEP — plugins scope |

**Action items:**
- Add `--fix` flag (auto-fix structural issues when feasible)
- Output sectioned: errors / warnings / info per section
- Distinction: `status` = drift content, `doctor` = structural health

### 5. `ide`

| Sub | Verdict |
|---|---|
| install | KEEP |
| uninstall | KEEP |
| list | KEEP |
| status | KEEP |
| update | KEEP |
| doctor | KEEP |
| restore | **ADD** (symmetry with `ai restore`) |

**Behavior locked:**
- `ide install vscode` writes baseline `.vscode/{settings,keybindings,extensions}.json`
- AI tools requiring vscode (copilot) add their tweaks cumulatively
- No `ide sync` (single-layer)
- AI/IDE split kept long-term

**Roadmap:** vscode (✓), then JetBrains, Sublime, Neovim

### 6. `marketplace`

| Sub | Verdict |
|---|---|
| add | KEEP — adaptive multi-tool registration, `--scope user\|project`, retroactive propagation prompt, Cursor warning, Copilot user warning |
| list [--plugins] | KEEP — `--plugins` flag merges old `browse` |
| remove | KEEP — multi-tool clean |
| refresh [--force] | KEEP — `--force` merges old `cache clear` |
| check | KEEP |
| browse | DROP → `list --plugins` |
| cache list / cache clear | DROP |

**Core value:** add marketplace → CLI propagates to all installed tools, adapting format per tool. Without CLI, user manually edits N config files with N schemas.

### 7. `migrate`

**KEEP** + **ADD auto-prompt on entry**

- Check manifest version on every CLI invocation
- Outdated + TTY → prompt: "Manifest vX detected. Migrate to vY? [y/N]"
- Outdated + non-TTY → exit 1 + hint
- `aidd migrate` remains for explicit/scripted use
- `--dry-run` previews fields stripped + diff

### 8. `plugin`

| Sub | Verdict | Notes |
|---|---|---|
| install | KEEP | Fusion with `add` + `pick`. Accepts name OR source path/url. No-args TTY = interactive picker. |
| remove | KEEP |  |
| list | KEEP |  |
| search | KEEP | Iterate plugins cross-marketplaces |
| update | KEEP | Plugin-oriented refresh |
| doctor | KEEP |  |
| add | DROP → `install` |
| pick | DROP → `install` (no-args interactive) |
| status | DROP → `status` global |
| sync | DROP → `ai sync` |
| restore | DROP → `ai restore` |

**Install input auto-detect:**
- Contains `://` or starts `/` or `./` → local/url source
- Contains `@` → plugin@marketplace
- Else → search registered marketplaces (prompt if ambiguous)
- No args + TTY → interactive picker

### 9. `restore` (top-level)

**KEEP** — cross-domain orchestrator
- Default: restore all manifest-tracked files cross-tool
- `restore [files...]` granular
- Distinct from `clean` (delete) and `migrate` (schema upgrade)
- Coexists with `ai restore`, `ide restore` (scoped)

### 10. `self-update`

**KEEP** — package manager wrapper

- Auto-detect manager (pnpm/npm/brew/yarn)
- Default channel `latest`
- `--beta` flag to switch channel
- Invokes manager's native command (`pnpm update -g`, `brew upgrade`, etc.)
- Pre-check current vs registry latest

### 11. `setup`

**KEEP + PUSH** — interactive wizard

**Behavior:**
- Interactive wizard multi-step + project context detection + recommendations
- Pre-register `aidd-framework` marketplace by default
- Re-run on existing project: diff state → propose actions (refresh/add/sync/migrate)
- Non-TTY mode kept (exhaustive flags)

**Flags simplification (10 → 6):**

Before:
```
--source <remote|local>
--path <dir>
--release <tag>
--ai <ids>
--ide <ids>
--all
--plugins <names>
--all-plugins
--recommended-plugins
--no-plugins
--yes
```

After:
```
--source <remote|local>                              # marketplace source mode (default: remote)
--path <dir>                                         # local marketplace path
--release <tag>                                      # version pin (remote)
--ai <ids|all>                                       # AI tools
--ide <ids|all>                                      # IDE tools
--plugins <none|all|recommended|name1,name2>         # unified plugin mode
--yes                                                # accept defaults
```

Drops: `--all`, `--all-plugins`, `--recommended-plugins`, `--no-plugins`

**Wizard interactive steps:**
1. Welcome banner
2. Project context detection (TS/Python/monorepo/framework present)
3. Source selection (remote default, local if framework detected locally)
4. Tool selection (multi-checkbox AI + IDE, smart defaults per context)
5. Plugin selection (recommended default, customize option)
6. Confirm summary
7. Install + sync
8. Post-install: next steps suggested

### 12. `status`

**KEEP** — drift detection cross-tool

- Default: all tracked entries cross-tool (ai + ide + plugins + configs)
- Scoped via `aidd ai status` etc
- `--verbose` for per-file details
- `--json` for scripting
- Read-only (no `--fix` — that's `doctor`)
- Hash recalc each call (no cache)
- Sectioned per tool/category

### 13. `sync` (top-level)

**KEEP** — cross-domain orchestrator

- Default: sync marketplace registry + plugin enabled state + flat materialization cross-tool
- Per-tool translation (Claude/Copilot/Codex object map, Cursor user-level, OpenCode flat)
- Cumulative settings (Copilot tweaks → `.vscode/settings.json` if vscode present)
- Interactive prompt on conflicts (TTY) or error (non-TTY)
- `--dry-run` preview
- Auto-triggered after `marketplace add` + `plugin install`
- Scoped variants: `ai sync`, `ide sync`

### 14. `update` (top-level)

**KEEP** — master upgrade orchestrator

- Default: update everything (CLI assets via `ai update`/`ide update` + plugins via `plugin update` + marketplace catalogs via `marketplace refresh`)
- Top-level = orchestrator → invokes sub use-cases (consistent pattern)
- Distinct from `sync` (cross-tool propagation) and `self-update` (CLI binary)
- Auto-triggered after `self-update` (new CLI may bundle new assets)

---

## Cross-cutting actions

### Architecture

- `--scope user|project` flag across install/marketplace add (matrix per tool, see top)
- Pre-register `aidd-framework` marketplace at setup
- Migration auto-prompt on CLI entry (TTY) / exit hint (non-TTY)
- Setup wizard multi-step with context detection
- Cursor strategy: user-level materialization `~/.cursor/plugins/local/` (default; opt-in project = manual register)
- Copilot user-level: warning (CLI can't write VSCode default profile)
- Setup flags simplification (10 → 6)
- `ide restore` symmetry with `ai restore`

### Drop list

- `marketplace browse` → fold `list --plugins`
- `marketplace cache list` / `cache clear` → fold `refresh --force`
- `plugin add` → fold `install`
- `plugin pick` → fold `install` no-args
- `plugin status` → `status` global
- `plugin sync` → `ai sync`
- `plugin restore` → `ai restore`

### Framework-side (separate work, not CLI)

- `aidd-framework` repo: make public
- Ship `.cursor-plugin/marketplace.json` in framework (for Cursor Team Dashboard imports)

---

## Metrics for success

- Installs CLI/month
- Activated projects
- Retention (X months after install)
- Multi-tool ratio (% users with ≥2 tools installed)

---

## Next phase

Re-brainstorm CLI role going forward, given:
- All 14 commands locked
- Cross-cutting actions identified
- Drop list known
- Pillars validated

Question to address next: **strategic direction for CLI v5+ — keep pure orchestrator, expand, or different mission entirely?**
