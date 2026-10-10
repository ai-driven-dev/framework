# Review: Goalify readability

- **Verdict**: approve
- **Diff**: `HEAD -> working tree`, Goalify, its catalogue entries and the rename-safe source guard
- **Axes run**: code, functional, relevancy
- **Date**: 2026-10-10
- **Findings**: 0 critical, 0 warning, 0 minor; six previous findings corrected

## Phases

### Phase 1: Preserve the existing contract

- [x] Three actions retained; no replacement by a prompt generator or new execution mechanism.
- [x] Existing tracking path, frontmatter, section structure and resume paths retained; canonical Log shape is byte-identical to HEAD.
- [x] Powerful orchestration and smallest available workers with maximum supported reasoning retained, including launches and relaunches.
- [x] Failures require evidence analysis and a changed approach before retry; verified successes stay checked.
- [x] Final completion still requires the orchestrator's concrete success command and exit 0.
- [x] Compatible Batch dispatch, sequential fallback, per-item verification and launch announcement retained.
- [x] Payment, destructive-action and scope boundaries retained; checks now precede autonomous confirmations explicitly.
- [x] No changes to Todo, Batch, manifests or unrelated plugin files; both catalogue entries follow the loop action rename.

### Phase 2: Correct the six reported authoring gaps

- [x] R1: rename the noun action to `03-run-loop.md`, with one action table row and updated callers/catalogues; no compatibility alias.
- [x] R7: show framing, confirmation, self-fix and iteration back-edges, with distinct prerequisite, success and safety outcomes.
- [x] R12: place the conditional return under the replanning step, preserving final evaluation when no unchecked steps remain.
- [x] R15: present reference facts as individual list items and retain the exact emitted Log format.
- [x] R16: define filling sources, replace task examples and require removal of every scaffold comment and unresolved placeholder.
- [x] R17: keep Log shape in its reference; completion and amendment policy belong to the loop action, with the template citing their owner.

### Phase 3: Keep validation usable during the rename

- [x] The source guard scans present tracked and nonignored untracked files; a real temporary Git repository proves the old path disappears and the new path is checked.
- [x] Fixture Git commands and enumeration strip inherited `GIT_*`; a real caller repository remains byte-identical under poisoned Git environment variables.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| - | - | - | - | None in the corrected scope | - |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (16/16 scoped criteria); instruction comparison plus real guard execution, not a Goalify runtime success rate |
| Files checked | Seven Goalify files, both catalogue entries, source guard; HEAD diff and naming convention |
| Unchecked | None in the six-finding correction scope |
| Unplanned | Source-guard repair was required because the renamed action remains a deleted tracked path until staging |
| Changed tests | `pnpm test:changed`: exit 0, under the Git-hook protection wrapper |
| Full scripts suite | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`: 444 passed, 0 failed, 0 cancelled, 0 skipped |
| Guard regression | Real unstaged-rename case and repository scan observed failing before the repair; both pass afterward |
| Git isolation | Guard suite passes with inherited `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and `GIT_COMMON_DIR`; all disposable caller `.git` file hashes unchanged |
| Static guards | `git diff --check`, skill argument-hint guard, Markdown links and referenced paths passed |
| Duplication guard limitation | Existing documentation guard does not scan skills; it is not evidence of R17 compliance |
| Live behavior | No Goalify goal loop executed; resume, failure/retry and final success are supported by instruction comparison only |
| Independent review | Fresh checker reviewed seven skill files and catalogue entries, then rechecked its four repair findings on disk: No remaining findings |
| Adjudication | Shared model/worker boundaries remain in the router; loop-only completion/amendment rules have one owner. Isolated workers retain their own safety payload |
| Resolved ambiguities | Confirmed ASCII journey explicitly converts to Mermaid without changing dependencies; nondecorative execution markers remain governed by the loop |
| Codex validator limitation | Installed `quick_validate.py` rejects required `argument-hint`; field retained, YAML/frontmatter and project hint guard validated instead |
| Router | Five distinct terminals, framing/confirmation/self-fix paths, recording before safety stops, and conditional returns represented; no router backlink introduced |
| Tracking setup | Updated action link, ASCII-to-Mermaid conversion and observable framing/confirmation cases |
| Autonomy action | Existing confirmation and safety rules retained; no change in this correction pass |
| Loop action | Verb-led name, subordinate loop return and reference-owned Log format; sequential fallback and Batch boundaries retained |
| Worker prompt | Existing isolated-worker scope, evidence and safety payload retained; no change in this correction pass |
| Tracking template | Filling/removal instructions and inline owner citations for amendments and Log format |
| Log reference | One fact per list item, append-only history and canonical UTC attempt format |
| Catalogues | Updated loop action name and resolvable link; no unrelated rows changed |
| Mutation scope | Scoped corrections and report only; no staging, commit or push |
