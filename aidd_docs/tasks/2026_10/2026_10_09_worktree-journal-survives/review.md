# Review: A worktree session outlives the worktree's removal

- **Verdict**: approved
- **Diff**: [#988](https://github.com/ai-driven-dev/framework/pull/988), `fix/worktree-journal-survives` against `next`, against [#932](https://github.com/ai-driven-dev/framework/issues/932) as amended, `brainstorm.md`, `plan.md`
- **Axes run**: code, functional, relevancy
- **Rounds**: seven independent reviews; every finding was fixed and re-reviewed until the last round returned nits only, which are fixed
- **Verification**: 13/14 criteria (93 %)

## Contract

- [x] A session in any worktree journals under `<git common dir>/aidd/runs/`, the same directory for every checkout of the clone — `cli/tests/integration/run-journal-location-agrees.integration.test.ts` (main checkout, subdirectory, linked worktree, bare clone's worktree, `AIDD_RUNS_DIR`)
- [x] The journal survives `git worktree remove` without `--force` — `scripts/__tests__/aidd-telemetry-journal.test.js`, `cli/tests/e2e/telemetry-worktree-journal.e2e.test.ts`
- [x] A report from any checkout counts every worktree's sessions — the same e2e, run from the main checkout and from the linked worktree
- [x] With the sink empty and the worktree removed, the session is caught up from the tool's own transcript and attributed to its task — `telemetry-worktree-journal.e2e.test.ts`, "caught up from the tool's own transcript"
- [x] Journals left in a live checkout's `aidd_docs/runs/` are still read; the common-dir copy wins for one session — `cli/tests/contexts/telemetry/infrastructure/run-journal-reader-adapter.integration.test.ts`
- [x] `forget` previews and removes every location, each on its own line, a worktree reached through a link counted once — `forget-telemetry-use-case.unit.test.ts`, `telemetry-forget-display.unit.test.ts`, `cli/tests/kernel/paths.unit.test.ts`
- [x] Only the cumulative figure is reported, no worktree axis — no `worktree` under `cli/src/contexts/telemetry/domain/report`
- [ ] A live Claude Code session in an agent's worktree — not run. The end-to-end tests replay the real hook with captured payloads, and a manual run on Windows (real hook, built CLI, real worktree, removal) attributed the session from both checkouts and after removal.

## Mutation evidence

| Change made on purpose | Result |
| --- | --- |
| `RUNS_UNDER_GIT_DIR = ["aidd", "run"]` on the CLI side | parity test: 4 of 5 fail, one per checkout shape |
| `legacyRunsDirs` returns `[]` | worktree e2e: the two "live worktree" cases fail |
| `resolvedRunsDir` back to `aidd_docs/runs` | every worktree e2e case fails, the transcript catch-up included |
| no per-session dedupe in the reader | both foreign-schema tests fail |
| `legacyRunsDirs` compares spelled paths again | the junction test fails (3 directories instead of 2) |

## Gates

- CI on the PR: every job green, `cli / gate` and `cli / Windows` included.
- Local, Windows: typecheck, `knip`, type honesty, lint on changed files, comment and catch ratchets, `check-doc-duplication`, `check-referenced-paths`, `check-markdown-links`.
- Local failures that also fail without this change and pass in CI: `commit-session-trailer` integration, persona e2e, multi-tool "reads three tools", five line-ending-driven architecture tests, the hook perf p95.

## Accepted limits

Recorded in `aidd_docs/memory/internal/decisions/one-run-journal-per-clone.md`: a worktree removed before this change stays lost; an older CLI with a newer plugin sees no new session, so the plugin README asks for the CLI first; a plugin updated mid-session, or a session resumed after the update, loses part of that one session's attribution; a `--separate-git-dir` clone or a submodule does not read its main checkout's pre-move journal from a linked worktree. The plugin README cannot name the minimum CLI version until release-please tags it.

## Out of scope

The backlog axis reads `none` for a task folder that exists only on another worktree's unmerged branch — tracked on [#975](https://github.com/ai-driven-dev/framework/issues/975).
