---
status: done
---

# Phase 2 — Rebuild the branch clean, then prove it holds

Session 2 (2026_09_29). Goal: rebuild the work on a clean lineage so every later proof binds to the branch that will be PR'd, then run the full test suite green at its head. No fix work in this phase; a failure is a finding for phase 5's triage.

## Branch rebuild

- [x] `feat/mistral-support` branched from `upstream/next` (`4919f046`); `vcs.md`'s routing table sends `feat/*` to `next`
- [x] `vibe/mistral-support-3eed3a` untouched: no force-push, no deletion, still at `2a8f5b42`
- [x] The 13 archive commits (12 feature commits plus `f4064900`, the merge of `main`) replayed as 4 grouped conventional commits, authors preserved:
  - `cebd3da7` `feat(cli): add Mistral Vibe support` — Vibe Nuage Agent, folds `f430866c`, `96f9175a`, `6424d956`, `b63d864e`, `aa55ce44`, `e5d03979`, `3e23f9b3`; 225 files
  - `ff455e5a` `fix(lefthook): tolerate CRLF in pre-commit checkers` — Matthieu Riffault, folds `50aef4c4`, `03d3031d`; 8 files
  - `57365421` `chore: ignore .vibe flat-build output` — Matthieu Riffault, folds `bbb4a87f`; 1 file (`2536a63a`'s `lefthook.yml` edit nets to zero in the archive tree, so nothing to carry)
  - `fd1b5ff1` `docs: record mistral-support debug notes and retroactive task record` — Matthieu Riffault, folds `46176a8e` and the phase-1 record commits; 11 files
- Replay commits used `--no-verify`: the content is a byte-exact tree restore already gated at the archive head; the suites below are the real gate at the new head
- Correction during replay, recorded for honesty: the first attempt's `cli` pathspec also restored `cli/pnpm-lock.yaml` from the archive, silently reverting `next`'s smol-toml 1.9 bump (the one file `next` changed that the archive had not). Redone with `:(exclude)cli/pnpm-lock.yaml`

## Fidelity proof

The plan's proof, `git diff vibe/mistral-support-3eed3a feat/mistral-support` empty, is unsatisfiable as written: `upstream/next` sits 5 commits ahead of `main` (2026-09-24 to 2026-09-28, all before this plan existed) and the archive merged `main`, not `next`. Equivalent proofs run instead:

- [x] `git diff upstream/next feat/mistral-support` is byte-identical to `git diff main vibe/mistral-support-3eed3a`: `diff -q` reports identical, 8931 lines each
- [x] `git diff vibe/mistral-support-3eed3a feat/mistral-support` is exactly `next`'s own delta: 5 files, +77/-78 (`codeql.yml`, `cli/pnpm-lock.yaml`, `package.json`, `pnpm-lock.yaml`, `release-please-config.json`)
- [x] Working tree clean after replay; nothing skipped, nothing extra

## Test run (head `fd1b5ff1`, node 22.23.3, pnpm 12.3.4 via corepack)

| Command | Result | Duration |
| --- | --- | --- |
| `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | 554/554 pass, 0 fail | 28s |
| `cd cli && pnpm test` | 532 files: 530 pass, 1 fail, 1 skip; 6820 tests: 6816 pass, 1 fail, 3 skip; exit 1 | 134s |
| `cd kanban && pnpm test` | 12/12 files, 68/68 tests pass; exit 0 | 8s |

The cli suite ran twice: once on the pre-existing `node_modules`, then after `pnpm install` synced it to the head's lockfile (the first install predated `next`'s smol-toml and commitlint bumps). Identical results both times — 530/532 files, same single failure, 134s then 114s — so the outcome does not depend on the dependency state.

## Failure (finding for phase 5)

- File: `cli/tests/contexts/telemetry/domain/formats/commit-session-trailer.integration.test.ts:72`
- Shortest decisive line: `AssertionError: expected 2 to be 1` — "never doubles a trailer a prior run already wrote"
- Deterministic: fails alone, fails under `env -i`; the three sibling tests pass
- Not introduced by this branch: `git diff upstream/next feat/mistral-support` touches no `commit-session-trailer` file; the test and its source are byte-identical to `next` (both from `95bdbbc3`), so the failure predates the replay
- Candidate root cause, from a 10-line standalone repro of the delegate: the fixture message `"merged"` has no trailing newline; git 2.39.2 then appends the trailer without a blank-line separator, so the second pass no longer sees a trailer block and `--if-exists doNothing` appends again. The same delegate run on a message ending in a newline dedupes correctly. Likely a git-version sensitivity (this machine runs 2.39.2); CI's newer git presumably passes it
- Triage in phase 5: defect report upstream or fixture fix, not a mistral-support issue

## Tooling note

The sandbox's default node was 20.19.2, where `node --test` does not expand globs; per user request nvm's default is now 22.23.3 and pnpm comes from corepack at the `packageManager` pin (12.3.4).

## Exit

- [x] Clean branch exists, fidelity evidence recorded above
- [x] Test commands run, pass rates and durations recorded above
- [x] The one failure quoted with its shortest decisive line and its file
