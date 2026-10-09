---
objective: "A session run in any worktree of a clone is journalled under the clone's common git directory, survives `git worktree remove`, and is counted by a report run from any checkout of that clone."
status: implemented
---

# Plan: A worktree session outlives the worktree's removal

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Move the run journal from `<worktree root>/aidd_docs/runs/` to `<git common dir>/aidd/runs/`, keep reading the old location of every live worktree, and make forget, check and the docs follow. |
| **Source** | [`brainstorm.md`](./brainstorm.md), refining [#932](https://github.com/ai-driven-dev/framework/issues/932) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | The hook writes under the common git directory | [`phase-1.md`](./phase-1.md) |
| 2   | The CLI resolves the same directory and the legacy ones | [`phase-2.md`](./phase-2.md) |
| 3   | The journal reader reads the new directory and every legacy one | [`phase-3.md`](./phase-3.md) |
| 4   | Forget removes every location, check names the real one | [`phase-4.md`](./phase-4.md) |
| 5   | End-to-end proof on real worktrees | [`phase-5.md`](./phase-5.md) |
| 6   | Decision record and docs | [`phase-6.md`](./phase-6.md) |

Run the phases in order. Each phase ends green on its own gate before the next starts:

- Phases 1 and 6 (`plugins/`, `scripts/`, docs): `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`, then `pnpm exec lefthook run pre-commit`.
- Phases 2 to 5 (`cli/`): `cd cli && pnpm test`, then `pnpm exec lefthook run pre-commit` and `pnpm exec lefthook run pre-push` from the repository root.

Never run the scripts suite bare (see `aidd_docs/memory/testing.md`). Never commit; the user commits.

**On Windows, `lefthook run pre-commit` / `pre-push` is not a usable gate.** lefthook 2.1.14 runs each multi-line `run:` through `sh -c "…"`, and the double quotes inside the `echo` lines of `lefthook.yml` close that `-c` (`syntax error: unexpected end of file`). Jobs that use `{files}` fail with no file staged (`exec: no command`). This holds on any Windows machine, has nothing to do with this plan, and CI's `validate.yml` replays the whole pre-commit on Linux. Wherever a phase says "pre-commit" or "pre-push", run the equivalent checks directly from the repository root instead. Each must exit 0, except the known failures listed below:

- Every phase: `node scripts/check-context-imports.js`, `node scripts/check-context-reference-form.js`, `node scripts/check-referenced-paths.js`, `node scripts/check-doc-duplication.js`.
- Phases touching `plugins/` or `scripts/` (1, 6): the wrapped scripts suite above.
- Phases touching `cli/` (2 to 5): `cd cli && pnpm lint && pnpm test:arch && pnpm typecheck && pnpm test && pnpm knip`, then `node scripts/check-cli-type-honesty.mjs` from the root.
- Phase 6 also runs `node scripts/check-markdown-links.js --ignore cli/tests/fixtures --ignore cli/aidd_docs/tasks`.

Failures that exist without this plan, recorded on 2026-10-09: report them, never fix them, do not stop for them.

- `check-markdown-links` and its three repository-scan tests: broken by the staged `aidd_docs/memory/README.md`.
- `check-skill-argument-hints.mjs`: no `argument-hint` in many unrelated skills. lefthook only runs it when `plugins/*/skills/**` changes, so it applies to phase 6 alone.
- `dev-sync.test.js` « managed OpenCode reload … »: depends on the environment.
- The hook perf test (budget 200 ms): already over budget without the change (see phase 1).
- `aidd-telemetry-trailer-repair.test.js` « a git that rejects --git-path still journals the session »: fails only inside the full suite. Run alone on the changed tree, it passes (`node --test --test-name-pattern="rejects --git-path" scripts/__tests__/aidd-telemetry-trailer-repair.test.js` gives `pass 1`).

Any other failure: stop and report.

## Rules the implementer follows everywhere

1. **Test first.** For every behaviour, write the test, run it, and see it fail for the reason it names before touching production code (`aidd_docs/memory/coding-assertions.md`).
2. **Read the file back after every scripted edit** before running anything.
3. **Exact names.** Use the function, constant and file names written in the phases. Do not rename, do not add parameters the phase does not list.
4. **Comment style.** Match the surrounding code: a short comment saying *why*, never *what*. No comment restating the code.
5. **Out of scope, do not touch:** `telemetry-on-use-case.ts` and `manifest-gitignore-entries.ts` (they keep git-ignoring `aidd_docs/runs/`, which still protects legacy files); `task-backlog-adapter.ts` (the backlog axis stays resolved in the current checkout); `read-local-cost-use-case.ts` and `report-cost-use-case.ts` (they read only through the reader port, which phase 3 changes); the sink; any report axis. No worktree axis is added.
6. If a step's instruction contradicts what the code actually contains, stop and report the contradiction instead of improvising.

## The location, stated once

| Situation | Primary directory (written and read) | Legacy directories (read only, never written) |
| --- | --- | --- |
| `AIDD_RUNS_DIR` set (non-empty) | `AIDD_RUNS_DIR` | none |
| Inside a git checkout (plain, linked worktree, worktree of a bare clone, submodule) | `<git common dir>/aidd/runs` | `<root>/aidd_docs/runs` of the current checkout, of the main worktree (non-bare only), and of every linked worktree still registered, each kept only when that directory exists, deduplicated, in that order |
| Hook: `git rev-parse` gave no common dir | `<repoRoot>/aidd_docs/runs` (unchanged behaviour) | n/a |
| CLI: no `.git` above the project root | `<projectRoot>/aidd_docs/runs` (unchanged behaviour) | none |

`<git common dir>` is what `git rev-parse --git-common-dir` prints, made absolute: `<repo>/.git` for a plain checkout and for its linked worktrees, `<repo>.git` for a bare clone's worktrees. The two path segments `aidd` and `runs` are fixed.

## Accepted edges (documented, not fixed)

- A worktree removed before this change, never read before, stays lost.
- A session started before the upgrade keeps its old file; lines the upgraded hook writes during that same session find no file in the new directory and are dropped until the next session.
- A session resumed after the upgrade gets a second run file in the new directory; the reader prefers the new-directory file, so the pre-upgrade part of that one session loses its attribution.

## Resources

| Source | Verified |
| ------ | -------- |
| <https://git-scm.com/docs/git-worktree> | A linked worktree's `.git` is a file `gitdir: <path>`; its git dir `<common>/worktrees/<id>` holds a `commondir` file (path to the common dir, relative to that git dir) and a `gitdir` file (absolute path to the worktree's `.git` file). `git worktree remove` deletes the worktree tree and its `<common>/worktrees/<id>` entry only, and refuses an untracked file without `--force` but not an ignored one. |
| <https://git-scm.com/docs/git-rev-parse#Documentation/git-rev-parse.txt---git-common-dir> | `--git-common-dir` prints `$GIT_COMMON_DIR` if defined, else `$GIT_DIR`; relative output is relative to the current directory. |
| Local run, git 2.52.0.windows.1 | `git worktree remove` without `--force` on a worktree whose only extra content is an ignored `aidd_docs/runs/j.jsonl` exits 0 and the directory is gone. |

## Decisions

| Decision | Why |
| -------- | --- |
| One journal per clone, under `<git common dir>/aidd/runs/` | Outside every working tree (nothing to commit, no branch dirtied, survives `git worktree remove`) and present even for a bare clone. Amends the hook's per-worktree decision while keeping its two reasons. |
| Legacy `aidd_docs/runs/` of every live worktree is read, never written | Today's sessions stay visible; one authoritative copy for new lines. |
| The CLI finds the common dir by reading files, not by spawning git | `repositoryRootAbove` already walks the filesystem; staying file-based keeps the reader free of a git dependency. A parity test pins it against the hook's `git rev-parse`. |
| No worktree axis in the report | The 2026-08-31 decision requires an argument for any new axis; the issue gives none. `worktree_id` stays in the journal. |
| `telemetry-on-use-case.ts` changed after all, despite rule 5 | Its message invited deleting the `.gitignore` line to commit the journal; new journals live under the git directory, which no commit reaches, so the text had to stop promising it. Only the message changed. |
