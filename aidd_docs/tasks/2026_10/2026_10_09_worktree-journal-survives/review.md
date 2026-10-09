# Review: A worktree session outlives the worktree's removal

- **Verdict**: approve
- **Diff**: `HEAD` working tree on `docs/worktree-journal-survives` (staged, unstaged, untracked), against [#932](https://github.com/ai-driven-dev/framework/issues/932), `brainstorm.md`, `plan.md`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_09
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — The hook writes under the common git directory

- [ ] Before task 2, the new and renamed tests fail because records still land in `aidd_docs/runs/` — chronology, absent from the final diff
- [x] A session in a linked worktree writes its run file to `<main>/.git/aidd/runs/`, and nothing lands in the worktree's `aidd_docs/runs/` — `scripts/__tests__/aidd-telemetry-journal.test.js:3592`
- [x] The main checkout and a linked worktree of one clone write into the same directory — `scripts/__tests__/aidd-telemetry-journal.test.js:3607`
- [x] After `git worktree remove` without `--force`, the removed worktree's run file still exists — `scripts/__tests__/aidd-telemetry-journal.test.js:3624`
- [x] With `AIDD_RUNS_DIR` set, the file lands there and nothing is created under `.git/aidd/runs` — `plugins/aidd-telemetry/hooks/lib/repo.cjs:209`, `scripts/__tests__/aidd-telemetry-journal.test.js:583`
- [x] `runsDir("/repo", "")` and `runsDir("/repo")` still answer `/repo/aidd_docs/runs` — `scripts/__tests__/aidd-telemetry-journal.test.js:575`
- [ ] The wrapped scripts suite and the pre-commit hook pass — not executed in this static review; the plan already waives lefthook on Windows

### Phase 2 — The CLI resolves the same directory and the legacy ones

- [x] From a main checkout, a subdirectory, a linked worktree and a bare clone's worktree, `gitCommonDirAbove` names the directory `git rev-parse --git-common-dir` names; outside any checkout it answers `null` — `cli/tests/kernel/reading/git-common-dir.unit.test.ts:45`
- [x] `worktreeRootsOf` lists the main root first then live linked worktrees, skips a deleted one, and lists no main root for a bare clone — `cli/tests/kernel/reading/git-common-dir.unit.test.ts:85`
- [x] `resolvedRunsDir` answers `<common dir>/aidd/runs` inside any checkout, `<dir>/aidd_docs/runs` outside, and `AIDD_RUNS_DIR` when set — `cli/tests/kernel/paths.unit.test.ts:130`
- [x] `legacyRunsDirs` lists every existing `aidd_docs/runs` of the clone's live checkouts, current first, without duplicates, and is empty under `AIDD_RUNS_DIR` or outside a checkout — `cli/tests/kernel/paths.unit.test.ts:154`
- [x] The hook and the CLI resolve the same directory from each of the four checkout shapes, and a one-segment change on the CLI side turns the parity test red — `cli/tests/integration/run-journal-location-agrees.integration.test.ts:58`

### Phase 3 — The journal reader reads the new directory and every legacy one

- [x] `RunJournalStore` exposes `legacyRunsDirs` and `listRunFilesIn`, and the adapter plus both doubles implement them — `cli/src/contexts/telemetry/domain/ports/run-journal-reader.ts:132`
- [ ] Before task 3, the six new cases fail — chronology, absent from the final diff
- [x] A journal under `<common dir>/aidd/runs` is read; a journal in another live worktree's `aidd_docs/runs` is listed and readable by its session id — `cli/tests/contexts/telemetry/infrastructure/run-journal-reader-adapter.integration.test.ts:241`
- [x] When one session has a file in both places, only the common-dir copy is returned by `read` and by `list` — `cli/tests/contexts/telemetry/infrastructure/run-journal-reader-adapter.integration.test.ts:273`
- [x] With `AIDD_RUNS_DIR` set, no legacy directory is read and `legacyRunsDirs` is empty — `cli/tests/contexts/telemetry/infrastructure/run-journal-reader-adapter.integration.test.ts:296`
- [x] A foreign schema in a legacy file is reported by `listForeignSchemas` — `cli/tests/contexts/telemetry/infrastructure/run-journal-reader-adapter.integration.test.ts:317`
- [ ] The whole CLI suite passes apart from the forget and check e2e files named in task 5 — intermediate gate, superseded by phase 4 in this snapshot

### Phase 4 — Forget removes every location, check names the real one

- [x] A preview whose only content is a legacy journal with run files is not empty — `cli/tests/contexts/telemetry/domain/telemetry-removal.unit.test.ts:60`
- [x] The forget preview lists each legacy directory holding run files, with their names, and omits an empty one — `cli/tests/contexts/telemetry/application/forget-telemetry-use-case.unit.test.ts:49`
- [x] Confirming removes the previewed files from their own legacy directory, counted together with the primary journal; a file refusing removal is reported by name and the rest are still removed — `cli/tests/contexts/telemetry/application/forget-telemetry-use-case.unit.test.ts:198`
- [x] The preview prints one `An earlier run journal ...` line per legacy directory, between the project journal line and the machine records line — `cli/src/presentation/display/telemetry-forget-display.ts:84`
- [x] `aidd telemetry check` with no run file names the reader's real `runsDir` instead of the hardcoded `aidd_docs/runs` label — `cli/src/contexts/telemetry/application/diagnose-telemetry-use-case.ts:240`
- [ ] The whole CLI suite, pre-commit and pre-push pass — not executed in this static review

### Phase 5 — End-to-end proof on real worktrees

- [x] From the main checkout, the report attributes a session journalled under the common git directory and a session still journalled in a live worktree's `aidd_docs/runs`, each to its task — `cli/tests/e2e/telemetry-worktree-journal.e2e.test.ts:143`
- [x] From the linked worktree, the report shows the same two attributions — `cli/tests/e2e/telemetry-worktree-journal.e2e.test.ts:152`
- [x] After `git worktree remove`, the session journalled under the common git directory is still attributed to its task — `cli/tests/e2e/telemetry-worktree-journal.e2e.test.ts:161`
- [ ] Disabling legacy reading, or the common-dir location, turns the matching case red — mutation not re-run; the three cases above are what would go red

### Phase 6 — Decision record and docs

- [x] The decision record exists, dated 2026-10-09, stating the location, the override, legacy reading, the absence of a worktree axis, and the alternatives refused — `aidd_docs/memory/internal/decisions/one-run-journal-per-clone.md:1`
- [x] The journal contract says where records land now, that legacy journals are still read, and links the decision — `aidd_docs/runs/README.md:3`
- [x] No edited document still says a session writes into `aidd_docs/runs/`; the verify step lists run files from the common git directory — `plugins/aidd-telemetry/skills/00-init/actions/03-verify.md:15`, `cli/src/presentation/display/telemetry-display.ts:84`
- [ ] The pre-commit hook and the scripts suite pass — not executed in this static review

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | - | `.agents/checker.md:1` | Untracked `.agents/checker.md` and `.agents/executor.md` are not in #932, the brainstorm, or the plan. | Leave them out of the commit. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 79% (26/33)                                      |
| Files checked | `plugins/aidd-telemetry/hooks/lib/repo.cjs`, `cli/src/kernel/reading/git-common-dir.ts`, `cli/src/kernel/paths.ts`, `cli/src/contexts/telemetry/infrastructure/run-journal-reader-adapter.ts`, `cli/src/contexts/telemetry/domain/ports/run-journal-reader.ts`, `cli/src/contexts/telemetry/domain/telemetry-removal.ts`, `cli/src/contexts/telemetry/application/forget-telemetry-use-case.ts`, `cli/src/contexts/telemetry/application/diagnose-telemetry-use-case.ts`, `cli/src/presentation/display/telemetry-forget-display.ts`, `cli/src/presentation/display/telemetry-display.ts`, `aidd_docs/runs/README.md`, `aidd_docs/memory/internal/decisions/one-run-journal-per-clone.md`, `aidd_docs/memory/README.md`, `cli/tests/e2e/telemetry-worktree-journal.e2e.test.ts`, `scripts/__tests__/aidd-telemetry-journal.test.js` |
| Unchecked     | Phase 1 red-first — not-applicable; Phase 1 suite and pre-commit — not-applicable; Phase 3 red-first — not-applicable; Phase 3 intermediate CLI suite — not-applicable; Phase 4 suite, pre-commit, pre-push — not-applicable; Phase 5 mutation re-run — not-applicable; Phase 6 pre-commit and scripts suite — not-applicable |
| Unplanned     | `.agents/checker.md`, `.agents/executor.md`       |
