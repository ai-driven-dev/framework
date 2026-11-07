---
objective: "The full mutation matrix runs only when the mutation setup changes, a dependency, workflow or shared test helper change runs only the scopes whose own source or mirrored tests it touches, and the promotion snapshot reuse is unchanged."
status: implemented
---

# Plan: PR 4 of stage A, mutation triggers

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Fix the mutation trigger so tooling changes stop launching the 29-leg matrix, without touching scopes, floors or which scopes gate. |
| **Source** | Text contract (stage A step 3), grounded in `target/07-test-architecture.md` sections 6.2, 6.3 and 9 (step 3), `target/00-overview.md` sections 10 (mutation bullet) and 12 (stage A). |

Out of scope: realigning scopes on the target contexts, removing the per-profile scopes, per-PR gate limited to `telemetry` and `shared`, floor changes, the weekly trend report (all `07` section 6.2, step 13 of section 9). No edit to `cli/mutation-scopes.json`, `cli/stryker.conf.json`, `cli/vitest.mutation.config.ts` or `.github/workflows/cli-ci.yml`.

Every path is relative to the repository root unless it follows a `cd cli`. `$B` is the baseline directory of phase 1: `B="${TMPDIR:-/tmp}/aidd-pr4-baseline"`. Nothing is committed.

### Current trigger logic, measured

The decision is made in two places: the `changes` job of `.github/workflows/cli-ci.yml` computes the diff, and `cli/scripts/mutation-scopes-to-run.mjs` turns it into legs.

| Trigger | Result today | Evidence |
| --- | --- | --- |
| `schedule`, Monday 03:00 UTC, on `main` | full matrix, every mutant replayed (`--force`) | `cli-ci.yml:14-17`; no `event.before` on a schedule, so `cli-ci.yml:191,194-196` sets `all=true`; `--force` at `cli-ci.yml:641`; the last three scheduled runs ran on `main` (`gh run list --event schedule`) |
| push to `main` or `next`, or a pull request, with an all-zero or empty base (new branch, force-push) | full matrix | `cli-ci.yml:11-13,194-196` |
| trusted promotion snapshot (`promote/next-to-main-<n>` PR to `main`, or the exact merge of one on `main`, whose tree passed `cli / gate` on `next`) | no leg | `cli-ci.yml:134-174,183-185` |
| `cli/mutation-scopes.json`, `cli/stryker.conf.json`, `cli/vitest.mutation.config.ts` | full matrix | `HARNESS`, `mutation-scopes-to-run.mjs:9-19`, used at `:25` |
| `cli/scripts/run-mutation.mjs`, `cli/scripts/mutation-scopes-to-run.mjs`, `cli/scripts/mutation-shards.mjs` | full matrix | `mutation-scopes-to-run.mjs:13-15` |
| `cli/package.json`, `cli/pnpm-lock.yaml` | full matrix | `mutation-scopes-to-run.mjs:16-17` |
| `.github/workflows/cli-ci.yml` | full matrix | `mutation-scopes-to-run.mjs:18` |
| anything under `cli/tests/helpers/` | full matrix | `mutation-scopes-to-run.mjs:25` |
| a file under a scope's source directory (`cli/<glob before /**>/`) | that scope's legs | `mutation-scopes-to-run.mjs:30,33` |
| a file under the mirrored test directory (`cli/src/` replaced by `cli/tests/`) | that scope's legs | `mutation-scopes-to-run.mjs:31,33` |
| anything else | no leg | `mutation-scopes-to-run.mjs:26-37` |
| manual run | does not exist: no `workflow_dispatch` | `cli-ci.yml:10-17` |

Measured with the script itself on the current tree (phase 1 records it): each of the eight file triggers above prints 29 legs; `cli/src/kernel/paths.ts` prints 4 (`kernel` 1/4 to 4/4); `README.md` prints `[]`; `cli/pnpm-lock.yaml` plus a `runtime` source file prints 29.

A full matrix on a pull request is not a full replay: each leg runs `--incremental` (`run-mutation.mjs:37-39`), and Stryker reuses a result unless the mutant's file or a covering test changed (`cli/aidd_docs/memory/testing.md:43`). A lockfile-only change therefore pays the fixed cost of 29 legs (install, initial test run) and replays almost no mutant. The replay that catches drift through a dependency is the weekly `--force` run.

### Target trigger logic

| Trigger | Target | Change |
| --- | --- | --- |
| `schedule` | full matrix, `--force` | none |
| empty or all-zero base | full matrix | none (fail-safe: no diff, no selection) |
| trusted promotion snapshot | no leg | none |
| mutation setup: `cli/mutation-scopes.json`, `cli/stryker.conf.json`, `cli/vitest.mutation.config.ts` | full matrix | none |
| mutation runner: `cli/scripts/run-mutation.mjs`, `cli/scripts/mutation-shards.mjs` | full matrix | none (decision D2) |
| the helpers the mutation config loads: `cli/tests/helpers/mutation-sequencer.ts`, `unloadable-file-as-failed-test.ts`, `vitest-text-loader.ts`, `throwaway-profile.ts` | full matrix | none for these four (decision D3) |
| `cli/scripts/mutation-scopes-to-run.mjs` | only the scopes the rest of the change touches | was full matrix (decision D4) |
| `cli/package.json`, `cli/pnpm-lock.yaml` | `canary` plus the scopes the rest of the change touches | was full matrix (decision D6) |
| `.github/workflows/cli-ci.yml` | only the scopes the rest of the change touches | was full matrix |
| any other file under `cli/tests/helpers/` | only the scopes the rest of the change touches | was full matrix |
| a scope's source or mirrored tests | that scope's legs | none (decision D5) |
| anything else | no leg | none |

Behaviour diff: three groups of paths (the workflow, the scope selector, the helpers the mutation config does not load) move from "all 29 legs" to "no leg of their own", and dependencies move to the single `canary` leg. Nothing moves the other way; no scope, floor or gate changes; the `changes` job and the workflow are not edited.

### Effect over the last 40 merged PRs into `next`

Window: the 40 most recent PRs merged into `next` at planning time (`gh pr list --state merged --base next --limit 40 --json number,headRefName,mergeCommit,files`). `07` section 6.1 counted "11 of 40, 9 full" on an earlier window; this one is newer.

| Count | Before | After | How |
| --- | --- | --- | --- |
| PRs running any mutation leg | 10 of 40 | 6 of 40 | simulated: current `scopesToRun` on each PR's final file list, and the target rule on the same list |
| PRs running the full matrix | 8 of 40: a workflow-only change, a change to a helper's own test, two Dependabot lockfile bumps, a pnpm upgrade, two features touching `package.json`, a change to `vitest.mutation.config.ts` | 1 of 40 (the `vitest.mutation.config.ts` change) | simulated, then checked against the observed leg count of every run below |
| Legs summed over the 40 PRs, one run each | 240 | 78 | simulated |
| `cli-ci` runs of those PRs (PR pushes plus the merge push on `next`) | 36 runs, 29 of them with the full 28 or 29 legs | 3 full runs (the `vitest.mutation.config.ts` change) | measured: run list per branch and per merge commit |
| Mutation job time of those 36 runs (legs plus the per-scope scoring jobs) | 3,632 job-min | 1,935 job-min | before measured; after measured as the summed duration of the legs whose scope the target keeps, in the same runs |
| Avoided | | 1,697 job-min, 47 % of the mutation time of these runs, about 42 job-min per merged PR on average over 40 | derived from the two measured sums; a lower bound, see the next row |
| Outside the 40-PR window: each release-please PR to `main` bumps `cli/package.json` and nothing under a scope | 2 full matrices per release (its PR run and its push on `main`), 252 job-min measured on the latest release | 1 leg (`canary`) | measured on one release; not added to the per-PR average |

Where the 1,697 job-min come from: one feature touching `package.json` 437 (15 runs, 29 to 21 legs), the two Dependabot lockfile bumps 504, the pnpm upgrade 365, the workflow-only change 238, the helper-test change 153. The `07` estimate of "about 15 job-min per PR" counted one matrix per PR; a merge into `next` reruns it as a push (`cli-ci.yml:11-12,191-192`), and every synchronize push reruns it too.

Not re-simulated after D6: the counts above assume a dependency change runs no leg; with `canary` each dependency-only PR adds 1 leg (about 0.5 job-min), so the "after" legs and minutes are a lower bound by that amount. Not measured, stated: billed minutes (GitHub rounds each job up to the minute, so billing is higher than job wall time); queue time; the second feature touching `package.json`, whose branch lists no `cli-ci` run (simulated 29 to 10 legs, not timed); the earlier pushes of the 15-run feature are assumed to carry its final file set; untrusted promotions and back-merge pushes; scope median per leg ranges from 0.5 min (`canary`) to 6.5 min (`runtime`), so a flat per-leg average would be wrong and is not used.

## Phases

| #   | Phase | Model | Depends on |
| --- | ----- | ----- | ---------- |
| 1   | Baseline capture | haiku | none |
| 2   | Trigger tests, written to fail | sonnet | 1 |
| 3   | Split the trigger list | sonnet | 2 |
| 4   | Memory | sonnet | 3 |
| 5   | Gates and final acceptance | haiku | 4 |

### Phase 1: Baseline capture (haiku)

> Freeze what the selector prints today, so phase 5 can show exactly which inputs changed.

Files touched: none in the tree. Writes only to `$B`.

Tasks:

1. `git status --porcelain` lists only the task folder.
2. Record the selector's output per input:

```sh
B="${TMPDIR:-/tmp}/aidd-pr4-baseline"; mkdir -p "$B"
for f in cli/pnpm-lock.yaml cli/package.json .github/workflows/cli-ci.yml \
  cli/tests/helpers/repository-root.ts cli/tests/helpers/mutation-sequencer.ts \
  cli/tests/helpers/throwaway-profile.ts cli/scripts/mutation-scopes-to-run.mjs \
  cli/scripts/run-mutation.mjs cli/scripts/mutation-shards.mjs cli/stryker.conf.json \
  cli/vitest.mutation.config.ts cli/mutation-scopes.json cli/src/kernel/paths.ts README.md; do
  printf '%s %s\n' "$f" "$(CHANGED="$f" ALL=false node cli/scripts/mutation-scopes-to-run.mjs | node -pe 'JSON.parse(require("fs").readFileSync(0)).length')"
done > "$B/before.txt"
```

3. `cd cli && pnpm exec vitest run --project architecture tests/architecture/mutation-covers-source.arch.test.ts tests/architecture/mutation-shards.arch.test.ts` is green.

Acceptance:

| Command | Expected |
| --- | --- |
| `cat "$B/before.txt"` | every line ends in `29`, except `cli/src/kernel/paths.ts 4` and `README.md 0` |
| the vitest command of task 3 | exit 0, no failed test |

### Phase 2: Trigger tests, written to fail (sonnet)

> Each new rule has a test that is red today for the reason it names.

Architecture projection:

```txt
cli/tests/architecture/
└── mutation-covers-source.arch.test.ts   ✏️ replace the harness-or-helper case, add three cases
```

Tasks, all in the `the guard itself` describe, reusing its `scopes` fixture (`kernel`, `tools`, `mutation-covers-source.arch.test.ts:138-141`):

1. Replace `runs the scopes a change touches ... all of them for the harness or a helper` (`:214-226`) with the same title minus "or a helper", keeping its source, mirrored-test, `README.md` and `all: true` assertions (`:215-219,225`) and its `HARNESS[0]` assertion (`:224`), and dropping the `cli/tests/helpers/repository-root.ts` to all-scopes assertion (`:220-223`).
2. Add `it.each` "runs no scope of its own for <file>, a tooling change" over `.github/workflows/cli-ci.yml`, `cli/scripts/mutation-scopes-to-run.mjs`, `cli/tests/helpers/repository-root.ts`: `scopesToRun([file], withCanary)` equals `[]`, where `withCanary` is the `scopes` fixture plus a `canary` scope. Add `it.each` "runs the canary scope only for <file>, a dependency change" over `cli/pnpm-lock.yaml`, `cli/package.json`: equals `["canary"]`; with no `canary` declared it equals `[]`; the declaration still names `canary`.
3. Add "a tooling change beside a source change runs that source's scope only" (workflow plus `cli/src/kernel/paths.ts` equals `["kernel"]`) and "a dependency change beside a source change adds the canary" (lock plus `cli/src/kernel/paths.ts`, with `withCanary`, equals `["kernel","canary"]`).
4. Add "every helper the mutation config loads reshapes every scope": read `vitest.mutation.config.ts` with `read`, collect each `./tests/helpers/<name>` specifier (imports and `globalSetup` entries), map `.js` to `.ts`, prefix `cli/`, and expect each to be in `HARNESS` and `scopesToRun([file], scopes)` to equal `["kernel", "tools"]`. The list is derived from the config, so a helper the config starts loading is held without editing the test.
5. Run the file and record which tests fail and why.

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm exec vitest run --project architecture tests/architecture/mutation-covers-source.arch.test.ts` | exit 1; failing: the three tooling `it.each` cases, the two dependency `it.each` cases and the no-canary case, case 3 (both), case 4 (`cli/tests/helpers/mutation-sequencer.ts` and the three others not in `HARNESS`); every other test passes |

Case 4's helper-to-all-scopes half already holds today (the prefix rule at `mutation-scopes-to-run.mjs:25`); its `HARNESS` membership half is what fails, so the test is red for its own reason.

### Phase 3: Split the trigger list (sonnet)

> The selector knows the mutation setup by name and ignores the rest of the tooling.

Architecture projection:

```txt
cli/scripts/
├── mutation-scopes-to-run.mjs     ✏️ HARNESS content and comments; drop the helpers prefix rule
└── mutation-scopes-to-run.d.mts   unchanged (HARNESS keeps its name and type)
```

Tasks:

1. In `HARNESS` (`mutation-scopes-to-run.mjs:9-19`): remove `cli/scripts/mutation-scopes-to-run.mjs`, `cli/package.json`, `cli/pnpm-lock.yaml`, `.github/workflows/cli-ci.yml`; add the four helpers `cli/tests/helpers/mutation-sequencer.ts`, `cli/tests/helpers/unloadable-file-as-failed-test.ts`, `cli/tests/helpers/vitest-text-loader.ts`, `cli/tests/helpers/throwaway-profile.ts`.
2. Line 25: drop `|| file.startsWith("cli/tests/helpers/")`.
3. Rewrite the two comments (`:8`, `:21-22`) to say what holds now: the harness is what reshapes how every scope is scored (the stryker and vitest mutation configs, the scope declaration, the runner, the shard partition, the helpers the mutation config loads); a dependency, workflow or other helper change runs only what its own files touch, because each leg is incremental and the weekly `--force` run is what replays a dependency's drift.
4. Mutation proof of each guard, reverted after each:
   - put `cli/pnpm-lock.yaml` back into `HARNESS`: the lock canary-only case, the no-canary case and both beside-a-source cases turn red;
   - drop the `canary` rule: the two canary-only cases and the canary-beside-source case turn red;
   - remove `cli/tests/helpers/throwaway-profile.ts` from `HARNESS`: only case 4 turns red;
   - restore the prefix rule of line 25: only the `cli/tests/helpers/repository-root.ts` case turns red.

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm exec vitest run --project architecture tests/architecture/mutation-covers-source.arch.test.ts tests/architecture/mutation-shards.arch.test.ts` | exit 0 |
| each mutation of task 4, the same command | exit 1, with exactly the named tests failing |
| `CHANGED=cli/pnpm-lock.yaml ALL=false node cli/scripts/mutation-scopes-to-run.mjs` | `[{"scope":"canary","shard":1,"of":1}]` |
| `CHANGED=cli/package.json ALL=false node cli/scripts/mutation-scopes-to-run.mjs` | `[{"scope":"canary","shard":1,"of":1}]` |
| `CHANGED=.github/workflows/cli-ci.yml ALL=false node cli/scripts/mutation-scopes-to-run.mjs` | `[]` |
| `CHANGED=cli/tests/helpers/repository-root.ts ALL=false node cli/scripts/mutation-scopes-to-run.mjs` | `[]` |
| `CHANGED=cli/scripts/mutation-scopes-to-run.mjs ALL=false node cli/scripts/mutation-scopes-to-run.mjs` | `[]` |
| `CHANGED=$'cli/pnpm-lock.yaml\ncli/src/kernel/paths.ts' ALL=false node cli/scripts/mutation-scopes-to-run.mjs` | the four `kernel` legs then `{"scope":"canary","shard":1,"of":1}` |
| `CHANGED=cli/tests/helpers/mutation-sequencer.ts ALL=false node cli/scripts/mutation-scopes-to-run.mjs \| node -pe 'JSON.parse(require("fs").readFileSync(0)).length'` | `29` |
| `CHANGED=cli/stryker.conf.json ALL=false OUTPUT=sharded node cli/scripts/mutation-scopes-to-run.mjs` | `["kernel","tools","telemetry","translate","framework","tools-codex"]` |
| `CHANGED= ALL=true node cli/scripts/mutation-scopes-to-run.mjs \| node -pe 'JSON.parse(require("fs").readFileSync(0)).length'` | `29` |
| `node --test scripts/__tests__/cli-ci-gate-covers-every-job.test.js` (wrapped as `testing.md` requires: `node scripts/check-tests-leave-git-alone.js -- node --test scripts/__tests__/cli-ci-gate-covers-every-job.test.js`) | exit 0: the promotion and `mutation` step assertions (`:115-121`) still hold, the workflow is unchanged |

### Phase 4: Memory (sonnet)

> The CLI bank says which change runs which scopes, once.

Architecture projection:

```txt
cli/aidd_docs/memory/
└── deployment.md   ✏️ one clause on line 7, after "through `scripts/mutation-scopes-to-run.mjs`"
```

Tasks:

1. Extend the `cli-mutation` clause of `deployment.md:7`: the full matrix runs on the weekly schedule, on a change to the mutation setup (the scope declaration, the stryker and vitest mutation configs, the runner, the shard partition, the helpers the mutation config loads), or when no base can be diffed; any other change runs only the scopes whose source or mirrored tests it touches, so a dependency, workflow or helper change alone runs none.
2. Leave `testing.md:43` as it is: "drift through a dependency an incremental run never replays is bounded to a week" stays true and is now the stated reason. Do not repeat its sentence (`scripts/check-doc-duplication.js`).
3. `cli/aidd_docs/memory/coding-assertions.md:32` ("one mutation job per scope a change touches") stays true; no edit.

Acceptance:

| Command | Expected |
| --- | --- |
| `node scripts/check-doc-duplication.js` | exit 0 |
| `grep -n "helpers the mutation config loads" cli/aidd_docs/memory/deployment.md` | one line, line 7 |

### Phase 5: Gates and final acceptance (haiku)

> Every gate is green and the selector's output changed only where the target table says.

Files touched: none. On a failure, one agent per failing assertion (`coding-assertions.md`).

Tasks:

1. Rerun the phase 1 loop into `$B/after.txt`, then `diff "$B/before.txt" "$B/after.txt"`.
2. `pnpm exec lefthook run pre-commit --all-files`.
3. `pnpm exec lefthook run pre-push --all-files`.
4. `git status --porcelain`.

Acceptance:

| Command | Expected |
| --- | --- |
| `diff "$B/before.txt" "$B/after.txt"` | exactly five lines change: `cli/pnpm-lock.yaml` and `cli/package.json` from `29` to `1`; `.github/workflows/cli-ci.yml`, `cli/tests/helpers/repository-root.ts`, `cli/scripts/mutation-scopes-to-run.mjs` from `29` to `0` |
| `pnpm exec lefthook run pre-commit --all-files` | exit 0 |
| `pnpm exec lefthook run pre-push --all-files` | exit 0 (runs `cli knip` and the full `cli` suite) |
| `git status --porcelain` | `cli/scripts/mutation-scopes-to-run.mjs`, `cli/tests/architecture/mutation-covers-source.arch.test.ts`, `cli/aidd_docs/memory/deployment.md`, and the task folder; nothing else, nothing committed |

After the PR is opened, outside this plan: its own `cli / changes` log should print `mutation legs: []`, since none of its files is setup or under a scope. That is the selector proving itself on its first real diff.

## Resources

| Source | Verified |
| ------ | -------- |
| `gh pr list --repo ai-driven-dev/framework --state merged --base next --limit 40 --json number,headRefName,mergeCommit,files` | the 40 PR file lists the counts are computed on; largest PR has 96 files, under the 100-file cap of the field |
| `gh run list --workflow cli-ci.yml --branch <ref>` and `--commit <merge sha>`, then `gh api /repos/ai-driven-dev/framework/actions/runs/<id>/jobs` | 36 runs for 9 of the 10 mutation-hitting PRs; per-job `started_at` and `completed_at` for every `cli / Mutation (...)` leg and scoring job |
| `gh run list --workflow cli-ci.yml --event schedule --limit 3` | scheduled runs execute on `main`, the default branch; the last one's mutation jobs passed (its failure was `cli / macOS`) |
| `CHANGED=<file> ALL=false node cli/scripts/mutation-scopes-to-run.mjs` on the current tree | the current trigger table, 29 legs for each harness file and any helper |

## Decisions

| Decision | Why |
| -------- | --- |
| D1. One file at the requested path, phases inline with model tier and acceptance commands; no `plan.md`, no `phase-<n>.md`, no `backlog-link.json` | The caller fixed the path, and `plan-pr1-test-levels-and-guards.md` set the precedent in this folder (its D1). The source names no ticket. |
| D2. The runner (`run-mutation.mjs`) and the shard partition (`mutation-shards.mjs`) count as mutation setup | Every leg runs `node scripts/run-mutation.mjs` (`cli-ci.yml:641`) and so does every scoring job (`cli-ci.yml:679`); it builds the Stryker arguments, prunes the incremental file and applies the floor (`run-mutation.mjs:37-39`, `testing.md:43`). It imports the partition (`run-mutation.mjs:14`), which decides which files each shard mutates. A change to either reshapes how every scope is scored, which only the matrix exercises end to end. |
| D3. The helpers the mutation config loads count as setup; the rest of `tests/helpers/` does not | `vitest.mutation.config.ts:2-4,34-35,39,45,50,56` loads `mutation-sequencer`, `unloadable-file-as-failed-test`, `vitest-text-loader` and `throwaway-profile`; they order, count and load every mutation run, so they are the config in another file. None imports another helper (their `import` lines name only `node:` and `vitest`), so the set is closed. The other helpers are ordinary test code that a scope's own tests reach; the mirrored-test rule and the weekly run cover them. Phase 2 case 4 derives the list from the config, so a helper the config starts loading cannot be missed. |
| D4. The scope selector (`mutation-scopes-to-run.mjs`) is not setup | It chooses legs; it does not change how a scope is scored. Its behaviour is held by `mutation-covers-source.arch.test.ts` (`:214-235`) and `mutation-shards.arch.test.ts`, run by `cli-architecture` on every relevant PR; a full matrix proves nothing about selection that those tests do not. Risk, stated: a PR editing it runs its own new version (`cli-ci.yml:201` runs from the PR checkout), so a selector that wrongly returns `[]` would skip mutation for that PR; the arch tests are what stop it. |
| D5. The mirrored-test trigger stays | `mutation-scopes-to-run.mjs:31,33` and its assertion at `mutation-covers-source.arch.test.ts:216-218`. A PR that only deletes or weakens a scope's tests can drop its score under the floor, and this rule is the only per-PR catch for it. The contract's "source files touched" is read as the scope's files, source and tests. Dropping it would change the counts above. |
| D6. The workflow, the selector and the other helpers run no scope of their own; a dependency change (`cli/package.json`, `cli/pnpm-lock.yaml`) runs the `canary` scope only, plus any scope whose source it touches. Settled by the coordinator. | The weekly `--force` run is the designed catch for dependency drift (`cli-ci.yml:15-16`, `testing.md:43`), and a PR's legs are incremental (`run-mutation.mjs:37-39`), so today's full matrix on a lockfile replays almost nothing. But `mutation-scopes.json`'s `$comment` gives `canary` the job of catching a Stryker or Vitest upgrade that bypasses the unloadable-file reporter or test selection, and otherwise that is checked only by the weekly run on `main`, after promotion. Cost: 1 leg, median 0.5 job-min measured over 29 runs. `mutation-scopes.json` is not edited (an edit to it is itself a full-matrix trigger). The selector's comment states this; `mutation-covers-source.arch.test.ts` holds it (canary-only for each dependency file, no scope when no `canary` is declared, canary added beside a source change, and the declaration still names `canary`). |
| D7. The fix lives only in `mutation-scopes-to-run.mjs`; the workflow is not edited | It already owns the selection (`cli-ci.yml:201-202` delegates to it), and the deterministic doctrine asks to extend the owner, not add a script. Leaving the workflow untouched keeps `cli-ci-gate-covers-every-job.test.js:115-121` valid and keeps the promotion reuse byte-identical. `HARNESS` keeps its name and type, so `mutation-scopes-to-run.d.mts` and its one importer need no rename; the existence guard at `mutation-covers-source.arch.test.ts:228-235` now covers the four helpers too. |
| D8. The empty-base fallback to the full matrix stays | `cli-ci.yml:194-196`: with no base there is no diff to select from, and falling back to nothing would read as "nothing changed". It is also how the schedule reaches the full matrix. Not named in the contract; kept as the fail-safe. |
