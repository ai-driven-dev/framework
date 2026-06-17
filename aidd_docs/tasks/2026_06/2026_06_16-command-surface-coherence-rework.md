# Command-Surface Coherence Rework (BREAKING)

> Branch off `main` (current `main` = 5a1d5d5). Breaking, batched into one release, NO deprecation aliases. Manifest stays v6 (no schema touch).
> Spec validated via brainstorm — do not re-litigate the target surface. This plan turns it into executable milestones.

---

## Reality check (verified against code, 2026-06-16)

I read the actual command + use-case files before planning. Most of the "new behavior" the spec describes **already exists**. The genuine code deltas are only two: the `sync`→`propagate` rename and the `marketplace check`→`doctor` fold. Everything else is verify-and-document.

| Spec point | Spec claim | Code reality (verified) | Delta |
|---|---|---|---|
| 1. Bare `aidd` → menu | "confirm what bare invocation does" | `cli.ts:103-104` — `cliArgs.length === 0 && process.stdout.isTTY` → `runMenuLoop()`. Already wired. Non-TTY with no args falls through to `program.parse` → Commander help. | **None (verify+doc).** Already implemented. |
| 2. `status` = drift only | KEEP | `status.ts` → `statusAllUseCase` → hash drift vs manifest. Already drift-only. | None for status. |
| 2. `doctor` = health + absorbs `marketplace check` | fold + remove `marketplace check` | `doctor.ts` → `doctorAllUseCase` = structural/health only. `marketplace check` is a **separate** command + use-case. | **CODE — M2.** The only health-side delta. |
| 3. `update` = fetch-newer + re-materialize configs, project-scoped, no CLI binary | broaden semantics | `update.ts` → `UpdateAllUseCase` **already** does all three: `updateTools` (re-materialize runtime/ide configs from bundle via `UpdateOneToolUseCase`), `updatePlugins` (`PluginUpdateUseCase` — fetch newer), `refreshMarketplaces`. Does not touch CLI binary. | **None (verify+doc).** Spec point (b): already current behavior. |
| 3. `self-update` = CLI binary only, separate | STAYS SEPARATE | `self-update.ts` separate; `cli.ts:68` excludes it from update-check hook. Already separate. | None. |
| 4. `restore` = revert to install bytes | unchanged | `restore.ts`/`ai restore`/`ide restore` → `restoreUseCase`. Unchanged semantics. | None. |
| 5. `sync` → `propagate` (top-level + `ai`) | rename | `aidd sync` (`sync.ts`), `aidd ai sync` (`ai.ts:180`). No `ide` sync (correct — 1 IDE tool). | **CODE — M1.** Rename. |
| 6. Per-tool verbs | install/uninstall/list/status/update/restore/doctor; `ai` adds propagate | `ai.ts` has all + `sync`. `ide.ts` has all minus sync (no propagate). `ai update [tool]`/`ide update [tool]` = scoped config re-materialization. | **CODE — M1** (ai sync→propagate only). Rest matches. |

### Collisions flagged for human decision

- **C1 — `status [tool]` / `doctor [tool]` positional does not exist at top level.** The spec target surface item 2 writes `aidd status [tool]` and `aidd doctor [tool]`. The **top-level** `status.ts` and `doctor.ts` take **no positional and no `--tool`** — they are all-scope orchestrators (`statusAllUseCase`/`doctorAllUseCase`). Per-tool filtering lives only on `ai status --tool <tool>` / `ai doctor --plugin`. **Decision needed:** add a new `[tool]` positional to top-level `status`/`doctor`, or treat the existing `ai`/`ide` scoped forms as sufficient? **Default (recorded D5): do NOT add new surface** — the scoped forms already cover it; adding a positional is scope creep beyond the stated breaking changes. Implement only if human overrides.
- **C2 — E2E_MAP.md is heavily pre-drifted, independent of this rework.** It documents `migrate`, `cache`, `config`, `marketplace browse`, and top-level `install`/`uninstall` — **none of which exist** in `cli.ts`. This drift predates this rework. **Do NOT absorb it.** Doc edits in M3 are scoped to ONLY the commands this rework touches (`sync`→`propagate`, `marketplace check` removal). The rest is a separate docs-reality concern (the branch name `fix/cli-docs-reality-sync` suggests it is already in flight elsewhere).
- **C3 — internal rename is implementer discretion.** The plan requires `propagate` on the **user-facing surface + tests + docs** only. Whether to also rename `SyncUseCase`, `sync-all-use-case.ts`, the `use-cases/sync/` dir, `syncUseCase`/`syncAllUseCase` deps keys is file-layout = out of planner scope (recorded D4). The implementer decides; internal names are not load-bearing for the user contract.

---

## Architecture of the two real changes

### The fold (M2) — boundary decision (D2)
- `marketplace check` is **network I/O**, result shape `{ stale, upstreamRemoved, skipped }` (`MarketplaceCheckUseCase`).
- `DoctorReport` is `{ healthy, toolHealth, issues: DoctorIssue[], pluginIssues }`. `DoctorIssue = { severity, message, fix }`.
- **Fold = map marketplace-check output into `DoctorIssue` entries**, surfaced through the **aidd-level `DoctorAllUseCase`** (`new DoctorAllUseCase(doctorUseCase)` gains a `MarketplaceCheckUseCase` dep), NOT the per-scope `DoctorUseCase`.
  - Rationale: keeps `ai doctor` / `ide doctor` **offline + structural**. Only the top-level `aidd doctor` pays the network cost and reports marketplace findings. This is the sharp boundary the spec asks for.
- `MarketplaceCheckUseCase` itself is **kept** (reused as a dep); only the **command** `marketplace check` and its menu entries are removed.

### Cross-references to update on removal of `marketplace check` (easy to miss)
- `cli.ts:53-59` — `ONLINE_COMMAND_PATHS` set contains `"marketplace check"` → remove that entry, and add `"doctor"` (D6 — the fold makes `aidd doctor` the new network-paying command in that slot).
- `marketplace.ts:15-29` — the `marketplace` action-menu `select` includes `{ name: "Check marketplaces", value: "check" }` → remove.
- `marketplace.ts:159-179` — the `.command("check")` block → remove.
- `menu-use-case.ts:229-235` — `{ name: "Check freshness", value: "marketplace-check", command: ["marketplace","check"] }` node → remove.

### The rename (M1) — user-facing touchpoints
- `cli.ts:16,43` — `registerSyncCommand` import + call. Command name string changes `sync`→`propagate` (file/function rename is D4 discretion).
- `ai.ts:35` — menu `select` choice `{ name: "Sync AI tools", value: "sync" }` → `propagate`.
- `ai.ts:180` — `ai.command("sync")` → `ai.command("propagate")`.
- `menu-use-case.ts:100-105` — "Sync" leaf under Manage AI tools (`command: ["ai","sync"]`) → `["ai","propagate"]`.
- `menu-use-case.ts:249-253` — "Sync everything" leaf (`command: ["sync"]`) → `["propagate"]`.
- Internal error message strings referencing `aidd ai sync` (e.g. `sync.ts:18`, `ai.ts:199`) → `aidd ai propagate`.

---

## Milestones

Sequencing keeps the **full** suite green after **every** milestone: **rename first (wide, mechanical) → fold second (behavior change) → docs last.**

`command-matrix-help.e2e.test.ts` is **assertion-based**, not golden-snapshot (verified: each `it(...)` does `expect(stdout).toContain("...")` against a help string; e.g. line 250 `sync exits 1 in non-interactive mode`, line 226 `doctor exits 0 and reports healthy`). There is **no snapshot file to regen**. So every help-test row that names a renamed/removed command is fixed **inside the milestone that changes that command** — M1 fixes the `sync` rows, M2 fixes the `marketplace check` rows. M3 is docs-only. No milestone ever ships with `command-matrix-help` red.

### M1 — Rename `sync` → `propagate` (user-facing surface)

**Scope:** Rename the user-facing command name everywhere it is invoked or displayed. Internal symbol/file renames at implementer discretion (D4).

**Files likely touched:**
- `src/application/commands/sync.ts` — command name `sync`→`propagate` (file rename optional, D4).
- `src/application/commands/cli.ts` — registration import/call name if file renamed.
- `src/application/commands/ai.ts` — `ai.command("sync")`→`"propagate"`; menu choice value+label; `--source`-required error string.
- `src/application/commands/menu.ts` / `src/application/use-cases/menu-use-case.ts` — two leaf `command:` arrays (`["ai","sync"]`, `["sync"]`) and labels.
- User-visible strings mentioning `aidd ai sync` / `aidd sync`.

**Tests to add/change:**
- `tests/e2e/sync-matrix.e2e.test.ts`, `tests/e2e/sync-plugins.e2e.test.ts` — invocations `sync`/`ai sync` → `propagate`/`ai propagate`. (File renames optional.)
- `tests/e2e/command-matrix-ai.e2e.test.ts` — any `ai sync` row → `ai propagate`.
- Any unit/integration test asserting the command name string or the `--source required` message.
- **`tests/e2e/command-matrix-help.e2e.test.ts` — fix the `sync` rows in THIS milestone** (assertion-based, no snapshot): the `sync exits 1 in non-interactive mode` test (line ~250) invokes `["sync"]` → change to `["propagate"]`; add/adjust a row asserting `["sync"]` and `["ai","sync"]` now exit 1 with unknown-command. The suite stays fully green at M1 close.

**Docs:** deferred to M3 (keep this milestone code+test only). Tests, including help-test rows for `sync`, are NOT deferred — they move with the code.

**Acceptance criteria:**
- `aidd propagate` and `aidd ai propagate` exist and behave exactly as `sync`/`ai sync` did.
- `aidd sync` and `aidd ai sync` are **gone** — invoking them exits non-zero with Commander's unknown-command error (assert this in an e2e row).
- `ide` has **no** `propagate` subcommand (unchanged; the asymmetry is intentional — documented in M3).
- **Full** suite green (unit + integration + **all** e2e including `command-matrix-help`). No red help rows carried forward.

---

### M2 — Fold `marketplace check` into `aidd doctor`; remove `marketplace check` command

**Scope:** Wire `MarketplaceCheckUseCase` into `DoctorAllUseCase`; map its `{stale, upstreamRemoved, skipped}` into `DoctorIssue` entries on the AI/top-level doctor report. Remove the `marketplace check` command and all its menu/hook cross-refs. Keep `MarketplaceCheckUseCase` itself.

**Files likely touched:**
- `src/application/use-cases/global/doctor-all-use-case.ts` — add `MarketplaceCheckUseCase` constructor dep; run it; merge findings (`stale`→warning issues, `upstreamRemoved`→warning/error issues with a `Fix:` hint, `skipped`→info/warning). Decide where in `DoctorAllResult` they surface (new field vs folded into an existing scope report) — keep within method-size rules (≤20 lines; extract a private mapper). **`private computeHealthy(ai, ide, plugins)` (line ~50) MUST gain the marketplace findings as a 4th input** so a stale/upstream-removed marketplace flips `healthy=false`. `execute` (line ~33) calls it — update both the signature and the call site.
- `src/infrastructure/deps.ts:648` — `new DoctorAllUseCase(doctorUseCase)` → add `marketplaceCheckUseCase` arg (already constructed at `:450`).
- `src/application/commands/doctor.ts` — print the new marketplace findings (or rely on existing `result.errors`/scope printing if surfaced there); ensure exit code reflects them.
- `src/application/commands/marketplace.ts` — remove `.command("check")` block + the "Check marketplaces" action-menu choice.
- `src/application/commands/cli.ts:53-59` — remove `"marketplace check"` from `ONLINE_COMMAND_PATHS`.
- `src/application/use-cases/menu-use-case.ts:229-235` — remove "Check freshness" node.
- `src/application/display/doctor-display.ts` — if marketplace findings need a dedicated print section.

**Tests to add/change:**
- New integration test: `DoctorAllUseCase` with stub `MarketplaceCheckUseCase` returning stale/upstreamRemoved/skipped → asserts they appear as doctor issues and flip `healthy=false`.
- New integration test: `ai doctor` / `ide doctor` (scoped `DoctorUseCase`) remain **offline** — do NOT invoke marketplace check (assert the marketplace dep is untouched at that level).
- Remove/repurpose any `marketplace check` e2e/unit coverage (`M8`/`M9` scenarios). Existing `MarketplaceCheckUseCase` unit tests stay (use-case kept).
- **`tests/e2e/command-matrix-help.e2e.test.ts` — fix the `marketplace check` rows in THIS milestone** (assertion-based): the `marketplace --help` test (line ~96) asserts subcommand strings — drop any `check` assertion; add `expect(stdout).not.toContain("check")`. Add a row: `["marketplace","check"]` now exits 1 unknown-subcommand. Suite stays fully green at M2 close.
- e2e: `aidd marketplace check` now exits non-zero (unknown subcommand). `aidd doctor` with a stale marketplace reports it.
- **Lifecycle e2e (real binary, per `3-cli-lifecycle.md`):** `aidd doctor` now performs marketplace **network I/O** — assert on the **built binary** that with an unreachable/missing marketplace it completes via the `skipped` channel, **degrades, does not hang or crash**. A mocked unit test does not prove this (rule: green unit gates do not prove a lifecycle-dependent feature fires). The existing `doctor exits 0 and reports healthy` row (line ~226) must still pass under the new network path in the seeded/offline-fixture case.

**Docs:** deferred to M3.

**Acceptance criteria:**
- `aidd marketplace check` is **gone** (unknown-subcommand error).
- `aidd doctor` reports stale marketplaces + upstream-removed plugins as health findings; healthy install still exits 0; findings flip exit to 1 (via the updated `computeHealthy`).
- `ai doctor` and `ide doctor` stay offline/structural — no marketplace network call.
- **`aidd doctor` is now a network command** (behavior change vs prior offline structural-only). With marketplaces unreachable it degrades through `skipped` and does not hang — asserted on the real binary. This change is surfaced for docs/reviewers (see D6).
- `ONLINE_COMMAND_PATHS` decision (D6) applied: `marketplace check` removed from the set; `doctor` either added (so it piggybacks the CLI update-check refresh) or explicitly recorded as not added. Whichever, the update-check piggyback still works for remaining online paths.
- Menus no longer offer "Check marketplaces" / "Check freshness".
- **Full** suite green (unit + integration + **all** e2e including `command-matrix-help` and the lifecycle row).

---

### M3 — Sync all docs to the new surface

**Scope:** Docs-only. The help-test assertions were already fixed in M1/M2 (no snapshot to regenerate — `command-matrix-help` is assertion-based). This milestone syncs human-readable docs. Doc edits scoped to ONLY commands this rework touched (C2: do not fix unrelated E2E_MAP drift).

**Files likely touched:**
- `tests/e2e/command-matrix-help.e2e.test.ts` — **already updated in M1/M2; no further change expected.** Listed only so the implementer confirms it is green, not to re-edit.
- `README.md` — lines `174-177,180,221,233,283,293-294,348,567`: `aidd sync`→`aidd propagate`, `aidd ai sync`→`aidd ai propagate`; remove `marketplace check` from the marketplace ops line (`:66` equivalent) and add "marketplace freshness now reported by `aidd doctor`"; document the intentional `ide`-has-no-propagate asymmetry.
- `aidd_docs/memory/project-brief.md` — `:48` (`ai ... sync ...`→`propagate`), `:66` (drop `check`), `:82` (`aidd update / status / sync / restore / doctor`→`propagate`); note doctor absorbs marketplace freshness.
- `aidd_docs/memory/codebase-map.md` — `sync` use-case row label if the dir/symbol was renamed in M1 (D4-dependent).
- `tests/e2e/E2E_MAP.md` — update ONLY the `## aidd sync` section → `## aidd propagate` and the `marketplace check` rows (M8/M9) → fold note. **Do not touch** the unrelated drifted sections (migrate/cache/config/browse/install/uninstall) — flag as out of scope.
- `ARCHITECTURE.md` if it names `sync` or `marketplace check` in a command list.
- `CHANGELOG.md` — add a breaking entry (see M4; may be merged into the release commit instead).

**Tests:** no test changes expected (help-test rows landed in M1/M2). Full suite must remain green after doc edits.

**Acceptance criteria:**
- `grep -rn "aidd sync\|ai sync\|marketplace check" README.md aidd_docs/memory ARCHITECTURE.md` returns nothing (excluding historical `aidd_docs/tasks/*` which are immutable records).
- `ide`-no-propagate asymmetry documented as intentional.
- Docs note that `aidd doctor` now reports marketplace freshness (and is therefore a network command — see D6/M2).
- Full suite (unit + integration + e2e) green.

---

### M4 — Release notes / CHANGELOG / version surface (no manifest bump)

**Scope:** Surface the release implications. This is documentation/release-prep, not schema work.

**Findings to record (spec point d):**
- **Manifest:** stays **v6**. No on-disk schema field added/removed/renamed by this rework. **No manifest version bump.** (Confirmed: fold reuses existing `MarketplaceCheckUseCase`; rename touches command names only.)
- **CHANGELOG / commit convention:** repo uses Conventional Commits with breaking marker `type(scope)!:` (cf. 5a1d5d5 `refactor(cli)!: ...`). The release commit(s) for this rework MUST carry `!` and a `BREAKING CHANGE:` footer enumerating:
  - `aidd sync` → `aidd propagate`
  - `aidd ai sync` → `aidd ai propagate`
  - `aidd marketplace check` removed — freshness now reported by `aidd doctor`
- **CLI binary version (package version):** bump is the release tooling's call (`aidd-vcs:03-release-tag` / release-please). This rework only flags that the bump must be a **major** (breaking). Surfaced, not decided here.

**Files likely touched:** `CHANGELOG.md` (if hand-edited rather than release-please-generated).

**Acceptance criteria:**
- Breaking changes enumerated in the release entry with the three removals/renames.
- Explicit confirmation in the entry that manifest stays v6.

---

## Decisions

| id | topic | decision | rationale |
|---|---|---|---|
| D1 | Milestone count | 4 milestones: M1 rename, M2 fold+remove, M3 snapshots+docs, M4 release-surface. | Only two real code deltas; the rest of the spec is already-current behavior. Keeping rename and fold separate keeps the suite green between them. |
| D2 | Where the fold lives | Wire `MarketplaceCheckUseCase` into the aidd-level `DoctorAllUseCase`, not the per-scope `DoctorUseCase`. | Keeps `ai doctor`/`ide doctor` offline + structural; only top-level `aidd doctor` pays network cost and reports marketplace findings — the sharp boundary the spec wants. |
| D3 | Keep `MarketplaceCheckUseCase` | Remove only the `marketplace check` **command** + menu/hook refs; keep the use-case as a `DoctorAllUseCase` dep. | The logic is correct and reused; only the user-facing entry point moves. |
| D4 | Internal symbol/file rename for sync→propagate | Implementer discretion. Plan mandates `propagate` only on user-facing surface + tests + docs. | File layout / internal naming is out of planner scope; internal names are not part of the user contract. |
| D5 | `status [tool]` / `doctor [tool]` top-level positional | Do NOT add a new positional. Scoped `ai`/`ide` forms already cover per-tool filtering. | Adding surface exceeds the stated breaking changes; default to no scope creep. Overridable by human (see C1). |
| D6 | `aidd doctor` and `ONLINE_COMMAND_PATHS` after the fold | Add `"doctor"` to `ONLINE_COMMAND_PATHS` in `cli.ts`. The fold makes top-level `aidd doctor` pay marketplace network I/O, so it now meets the set's own criterion ("commands already paying for network I/O — piggyback the update-check refresh"). Mirrors the removed `marketplace check` entry. | Consistency: the slot that justified `marketplace check` in the set now belongs to `doctor`. Implementer may record a counter-rationale and leave it out, but the default is add. Either way, the behavior change (doctor is no longer offline) is surfaced to docs/reviewers and asserted on the real binary (M2). |

### Optional human override (not a blocker — M1–M4 proceed)

- **C1 (top-level `[tool]` positional on status/doctor):** spec target surface writes `aidd status [tool]` / `aidd doctor [tool]`, but the top-level commands currently take no positional. **Resolved conservatively as D5 — do not add new surface; scoped `ai`/`ide` forms cover per-tool filtering.** The plan is complete and executable as-is. This appears here only as a single, consistent flag: **if** the human explicitly wants the literal top-level `[tool]` positional, that is one additional small milestone (add positional → delegate to scoped use-case). No decision is left open — the default holds unless overridden.

---

## Suggested commit boundaries
1. M1 rename (code + tests incl. help-test `sync` rows, no docs) — one breaking commit `refactor(cli)!: rename sync to propagate`. Full suite green.
2. M2 fold + remove (code + tests incl. help-test `marketplace check` rows + lifecycle row) — `feat(cli)!: fold marketplace check into doctor; remove marketplace check`. Full suite green.
3. M3 docs — `docs(cli): sync docs to propagate/doctor surface` (no test changes; help-test already green from M1/M2).
4. M4 release surface — folded into the release PR / `aidd-vcs:03-release-tag` flow.
