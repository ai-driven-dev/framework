# CLI ↔ Documentation Sync Audit

- **Date**: 2026-06-05
- **Repo**: `aidd/cli` (branch `fix/flat-plugin-prefixed-names`, package `@ai-driven-dev/cli` v4.6.0)
- **Mode**: read-only audit. No code or doc changes.
- **Conflict policy**: neutral — each drift shows *doc claim* vs *actual* side by side. For **command/flag existence (parity)**, code is ground truth: existence is a verifiable fact, not a verdict (a documented command either is or isn't registered). For **doc-vs-doc conflicts (section E)**, no winner is declared — both sides quoted, reconciliation left to the maintainer. Severity reflects user-facing impact only.
- **Doc side verified**: every README claim in sections A/B confirmed verbatim via direct `grep` of README.md (line numbers below are real), not taken from intermediate extraction.

## Scope

| Axis | Source of truth (code) | Compared docs |
| --- | --- | --- |
| Command/flag parity | `src/cli.ts` + `src/application/commands/*` | README.md, ARCHITECTURE.md, MIGRATION.md, `aidd_docs/memory/*` |
| Behavior match | command handlers + use-cases | README.md, memory |
| Framework-build / target output | `deps.ts` registry, `tool-contracts.ts`, `framework-build-use-case.ts` | README.md, framework task docs |
| Template / init output | framework `02-project-init` templates + `init-use-case.ts` | README.md, `project_brief.md` |
| Naming / structure | code constants + manifest schema | README.md, ARCHITECTURE.md, MIGRATION.md, memory |

## Severity legend

- **S1 — broken contract**: doc tells user to run a command/flag that does not exist (or claims a behavior the code does not implement). User-facing failure.
- **S2 — drift**: doc and code describe the same thing differently; one is stale. Confusing, not immediately breaking.
- **S3 — doc-vs-doc**: two docs contradict each other; code may match one.
- **S4 — code-internal**: code itself is inconsistent (e.g. dead flag) — feeds doc confusion.

---

## A. Command / flag parity (S1 — highest impact)

All "actual" rows verified directly against `grep '.command('` / `.option(` in source.

| # | Doc claim | Doc location | Actual (code) | Sev |
| --- | --- | --- | --- | --- |
| A1 | `aidd plugin add owner/repo` (+ `--tool`) | README.md:233,357-358; ARCHITECTURE.md:54; project_brief.md:61 | **No `plugin add` subcommand.** `plugin` = create, remove, list, install, search, update, doctor (plugin.ts:33-232) | S1 |
| A2 | `aidd plugin pick` (interactive browse+install) | README.md:186,233; ARCHITECTURE.md:54 | **No `plugin pick` subcommand.** Interactive pick folded into `plugin install` (plugin.ts:124,158) | S1 |
| A3 | `aidd marketplace browse <name>` (+ `--use-cache`) | README.md:234,385-386; ARCHITECTURE.md:55 | **No `marketplace browse`.** `marketplace` = add, list, remove, refresh, check (marketplace.ts:32-160). Catalog listing = `marketplace list --plugins` | S1 |
| A4 | `aidd marketplace cache list` / `cache clear [name]` | README.md:234,392-394; ARCHITECTURE.md:55; project_brief.md:69 | **No `marketplace cache` subcommand.** Only `marketplace refresh --force` ("Clear cache before re-fetching", marketplace.ts:137) | S1 |
| A5 | `aidd update --dry-run` / `--tool <name>` / `--docs` | README.md:153-155,342 | **`aidd update` has only `-f, --force`** (update.ts:10) — and that is dead (see D-block / A12). No `--dry-run`, `--tool`, `--docs` | S1 |
| A6 | `aidd setup --all` | README.md:130,213,274; project_brief.md:41 | **No `--all` flag.** Use `--ai all` / `--ide all` (setup.ts:96-97) | S1 |
| A7 | `aidd setup --recommended-plugins` (and `--all-plugins`/`--no-plugins`) | README.md:213,275; project_brief.md:41 | **No such flags.** Single `--plugins <mode>` where mode ∈ none\|all\|recommended\|names (setup.ts:98) | S1 |
| A8 | `aidd status ai` / `aidd status ide` / `aidd status --docs` | README.md:317-319; ARCHITECTURE.md:57 | **`aidd status` takes no positional arg, no flags** (status.ts:9). Per-tool drift = `aidd ai status` / `aidd ide status` | S1 |
| A9 | `aidd doctor ai` / `aidd doctor ide` | README.md:330-331 | **`aidd doctor` takes no positional arg** (doctor.ts:9). Per-tool = `aidd ai doctor` / `aidd ide doctor` | S1 |
| A10 | `aidd restore <tool>` / `aidd restore <tool> <file>` / `--docs` / `--tool` | README.md:163-166,231 | **Top-level `aidd restore` has only `-f, --force`** (restore.ts:8) — no tool arg, no `[files...]`, no `--docs`. The `[files...]`/`--tool` surface is on `aidd ai restore` / `aidd ide restore` | S1 |
| A11 | `aidd sync --source` / `--target` / `--force` | README.md:174-176,232 | **Top-level `aidd sync` has no flags** (sync.ts:9); TTY-only, errors in non-TTY directing to `aidd ai sync --source`. Full flag set is on `aidd ai sync` | S1 |
| A12 | `aidd ai uninstall --all` | README.md:203 | **`aidd ai uninstall <tool>` requires a tool arg, no `--all`** (ai.ts:73) | S1 |

> Net: the README "Quick examples" and several memory tables document a **noun-second / legacy surface** (`status ai`, `restore <tool>`, `plugin add`, `plugin pick`, `marketplace browse`, `marketplace cache`, `setup --all`) that the current noun-first CLI does not expose. Many of these are the *pre-refactor* spellings the same README elsewhere lists as "removed".

### Self-contradiction inside README (S3, but command-facing)

| # | Issue | Location |
| --- | --- | --- |
| A13 | README:342 tells users `Use 'aidd install ai <tool>' to add a new tool`, but README:568 lists `aidd install ai <tool>` as **removed** (→ `aidd ai install`). Doc points at its own removed command. | README.md:342 vs 568 |

---

## B. Behavior match (S1–S2)

| # | Doc claim | Doc location | Actual | Sev |
| --- | --- | --- | --- | --- |
| B1 | "Runtime configs **and memory stubs are bundled in the CLI binary**." | README.md:3 | **False today.** No `MemoryCapability` / `memory-capability.ts` anywhere in source; no `templates/memory` in CLI. Memory templates live in the `aidd-context` framework plugin. project_brief.md:93 and ARCHITECTURE.md:73 state the correct (unbundled) reality. | S1 |
| B2 | "Init \| Bootstrap: creates `aidd_docs/` structure + manifest" | project_brief.md:33 | **CLI `init-use-case` creates only `.aidd/manifest.json` + `.aidd/cache` gitignore** (init-use-case.ts:69-79). The `aidd_docs/` + memory bank is scaffolded by the framework `02-project-init` skill, not by CLI code. Claim conflates skill flow with CLI. | S2 |
| B3 | `--force` flags advertised as overwrite controls on `aidd update`, `aidd ai update`, `aidd ide update` | README.md:156,218,226 | **Dead flags** — see A12-block / S4-1..3. `update --force` is never read; `ai/ide update --force` default true and never read (force hardcoded true). | S2 |
| B4 | "`--tool <name>` only updates tools already present" (update) | README.md:342 | No `--tool` flag exists on `aidd update` (A5). Claim describes a non-existent option. | S1 |

---

## C. Framework-build / target output match (S2–S3)

Code reality (verified): 5 targets (claude, cursor, copilot, codex, opencode); 2 modes (marketplace, flat); **9 registered cells** (4 marketplace + 5 flat); `opencode:marketplace` intentionally absent. README.md:440-462 **matches code** (targets, modes, per-tool layout, opencode flat-only, `--force` flat-only). The drift is in the task docs:

| # | Doc claim | Doc location | Actual (code) | Sev |
| --- | --- | --- | --- | --- |
| C1 | Copilot marketplace emits `.github/plugin/plugin.json` + `.github/plugin/marketplace.json` | conformance-matrix.md:50 | Code emits **`.plugin/`** (`manifestDir:".plugin"`, `OUTPUT_PLUGIN_MANIFEST_RELATIVE=.plugin/plugin.json`). Same doc's live-validation footer (lines 166/173/179) already says `.plugin/` — **top table stale**. | S3 |
| C2 | Codex flat skills at `.agents/skills/<skill>/SKILL.md` | conformance-matrix.md:67,124 | Code emits **`.codex/skills/`** (`CODEX_SKILLS_PREFIX=".codex/skills/"`). Same doc's footer (lines 171/180) already says `.codex/skills/` — **top table + residual-risks stale**. | S3 |
| C3 | ARCHITECTURE implies per-tool plugins carry `rules`/`commands` | ARCHITECTURE.md (capabilities prose) | Framework build treats `rules` + `commands` as `{supported:false}` for all 5 targets (`OUT_OF_SCOPE_PLUGIN_SECTIONS`, warn+skip). ARCHITECTURE.md has **no `framework build` section at all**; all build docs live only in README. | S2 |
| C4 | "tool-native plugin tree … copilot + codex shipped, **cursor/opencode pending**" | memory/architecture.md:64 | All 5 targets shipped (code registry + README:452 + recent commits "5 tools live-validated"). Memory note is stale. | S2 |
| C5 | Foreign-format probe paths: codex `.agents/plugins/marketplace.json`, copilot `.github/plugin/plugin.json` | memory/architecture.md:124,129 | Disagrees with README "supported formats" table (codex `.claude-plugin/marketplace.json`, copilot `extensions.json`). One of the two path sets is stale; needs reconcile against `MARKETPLACE_PROBES` in source. | S3 |

---

## D. Project-init template / scaffold output match (S2)

| # | Doc claim | Doc location | Actual | Sev |
| --- | --- | --- | --- | --- |
| D1 | Memory bank files (underscore): `codebase_map.md`, `coding_assertions.md`, `project_brief.md` | CLI `CLAUDE.md` `<aidd_project_memory>`; live `aidd_docs/memory/` | Framework templates (current) use **hyphens**: `codebase-map.md`, `coding-assertions.md`, `project-brief.md`. Action-03 output contract = verbatim basename, so a fresh `init` today produces hyphenated files. CLI's own underscored memory bank predates current templates and would not be reproduced. (Other 4 files — architecture/deployment/testing/vcs — match.) | S2 |
| D2 | (see B1) "memory stubs bundled in CLI binary" | README.md:3 | Templates live in framework plugin, not CLI. | S1 (dup of B1) |
| D3 | Fixture `tests/fixtures/framework-real` carries 6 init actions incl. `05-init-rules-skeleton.md` | fixture (v4.1.0-beta.12) | Current skill has 5 actions, no rules-skeleton (removed; rules created lazily by `03-context-generate`). Test-fixture drift only, non-blocking. | S4 |

No missing templates: every scope-matched template basename maps 1:1 to an init output file.

---

## E. Naming / structure conventions (S3)

| # | Issue | Locations |
| --- | --- | --- |
| E1 | **Manifest path stated 2 ways**: `.aidd/manifest.json` (architecture.md:28, project_brief.md:20) vs `aidd_docs/manifest.json` (MIGRATION.md:62). Backup path likewise split: `aidd_docs/manifest.backup.json` (MIGRATION.md:74) vs `.aidd/manifest.backup.json` (MIGRATION.md:76). Code uses `.aidd/manifest.json`. | multi |
| E2 | **Manifest schema key count**: ARCHITECTURE.md:44 = `{version, tools, plugins, marketplaces}` (4 keys) vs MIGRATION.md:62 = `{version, tools, marketplaces}` (3 keys). project_brief.md:94 says top-level `plugins` removed (plugins are per-tool under `tools[id]`) → ARCHITECTURE's top-level `plugins` key looks stale. | ARCHITECTURE.md:44 vs MIGRATION.md:62 |
| E3 | **Removal event labeled two versions**: README:562 + MIGRATION.md title = "v4.0 → v4.1"; ARCHITECTURE.md:67 + project_brief.md:84 = "removed in v5". Same removals, two version labels. | multi |
| E4 | `--release v4.1.0` example will read stale as framework advances past 4.1.0. | README.md:124,260; MIGRATION.md:97 |

---

## F. Code-internal inconsistencies (S4 — root cause for several doc drifts)

| # | Issue | Location |
| --- | --- | --- |
| F1 | `aidd update -f, --force` declared but **never read** (handler param `_cmdOptions`); `updateAllUseCase.execute(projectRoot)` ignores it. | update.ts:10-? |
| F2 | `aidd ai update -f, --force` default `true`, **never read**; force hardcoded true. | ai.ts:156-180 |
| F3 | `aidd ide update -f, --force` default `true`, **never read**; force hardcoded true. | ide.ts:141-165 |
| F4 | `--token` plumbing differs: `marketplace add` mutates `process.env.AIDD_TOKEN` (marketplace.ts:65); `plugin install` passes token through use-case (plugin.ts:153). Same flag, two mechanisms. | marketplace.ts:65 / plugin.ts:153 |
| F5 | Bare-group UX inconsistent: `ai`/`ide`/`plugin`/`marketplace` bare → TTY interactive picker; `auth` bare → always help; `framework` bare → commander default help. | various |

---

## Summary

| Axis | Findings | Of which S1 |
| --- | --- | --- |
| A. Command/flag parity | 13 | 12 |
| B. Behavior | 4 | 2 |
| C. Framework build | 5 | 0 |
| D. Init templates | 3 | 1 (dup) |
| E. Naming/structure | 4 | 0 |
| F. Code-internal | 5 | 0 |

**Headline**: the README's command reference and several memory tables are the most out-of-sync surface — they document a **legacy noun-second command shape** (`status ai`, `restore <tool>`, `plugin add`, `plugin pick`, `marketplace browse`, `marketplace cache`, `setup --all`, `update --tool/--docs/--dry-run`) that the current noun-first CLI no longer exposes. Ironically, parts of that same legacy surface appear in README's own "Removed surface" section.

**Secondary**: README's framework-build matrix is accurate, but the framework **task docs** (conformance-matrix) and **memory/architecture.md** carry pre-fix paths and a stale "cursor/opencode pending" note. Internal doc-vs-doc conflicts on manifest path, schema key count, and version labels remain unresolved.

**Code-side root causes**: three dead `--force` flags actively mislead docs.

## Recommended next steps (no code changes here)

1. **Rewrite README "Commands" + "Quick examples"** against the verified A-table — single source = `src/application/commands/*`. Highest user impact.
2. **Decide truth for E1/E2/E3** (manifest path, schema keys, version label) and propagate to all four docs.
3. **Fix or remove the 3 dead `--force` flags** (F1-F3), then make docs match.
4. **Sync stale task/memory tables** C1/C2 (copy the doc's own corrected footer values up), C4 (drop "pending").
5. **Resolve init naming** D1: pick hyphen or underscore as the canonical memory-bank filename and align CLI memory + templates + `<aidd_project_memory>` block.

---

## Remediation (applied 2026-06-05)

Principle: **reality docs (README/ARCHITECTURE/MIGRATION/memory) aligned to current code; roadmap = `framework/ROADMAP.md`.** All findings were reality-misalignment (zero legitimate projection in CLI docs).

**New finding surfaced during fix — E5: manifest is `v6` in code (`MANIFEST_VERSION = 6`), every doc said `v5`.** Path confirmed `.aidd/manifest.json` (MIGRATION's `aidd_docs/manifest.json` was always wrong); `plugins` is per-tool (ARCHITECTURE's top-level 4-key schema was wrong).

| Area | Action |
| --- | --- |
| Code (F1-F3 / A5 / B3) | Removed dead `-f,--force` from `aidd update`, `ai update`, `ide update` (`update.ts`, `ai.ts`, `ide.ts`). Fixed `update-global.e2e.test.ts` + help-matrix comment. Logged for re-implementation → **issue [#286](https://github.com/ai-driven-dev/aidd-cli/issues/286)** |
| README (A1-A13, B1, B4, C5) | Rewrote command examples + Commands table to real surface; fixed foreign-format probe table to code (`MARKETPLACE_PROBES`); fixed removed-surface `cache` rows |
| ARCHITECTURE | Manifest → v6 `{version,tools,marketplaces}` (plugins per-tool); command lists; added Framework-Build section (rules/commands out-of-scope) |
| MIGRATION | Manifest path → `.aidd/manifest.json`; `cache` mappings; v6 note (kept historical v4.0→v4.1 framing) |
| memory/* | `architecture.md` (all 5 build targets shipped); `project_brief.md` (setup/plugin/marketplace flags, v6, init scope); `codebase_map.md` (use-case inventories) |
| tasks/conformance-matrix (C1, C2) | Corrected copilot marketplace `.plugin/` + codex flat `.codex/skills/` top tables |
| Init naming (D1 → **hyphen**) | `git mv` `codebase_map`→`codebase-map`, `coding_assertions`→`coding-assertions`, `project_brief`→`project-brief`; updated `CLAUDE.md` @-includes + `aidd_docs/README.md` table |

**Verified:** `pnpm typecheck` clean · full `tests/e2e` suite **145/145** pass (incl. command-matrix ai/help/plugin 55/55, which guard the command+flag surface) · real-CLI smoke (`update --force` / `ai update --force` / `ide update --force` now error; `plugin create`/`doctor` + `marketplace check` present; no `add`/`pick`/`browse`/`cache`). Biome lint OOM'd in sandbox (environmental, edits only removed lines — runs pre-commit via lefthook). No test asserts the removed surface.
