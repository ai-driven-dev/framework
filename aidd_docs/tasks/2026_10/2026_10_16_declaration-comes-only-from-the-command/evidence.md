# Evidence: A declaration comes only from the command

Every run below is sandboxed (temp `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR`, `GIT_CONFIG_NOSYSTEM=1`), as the suites set them.

## Probe: what git does on copy and rename

`git branch -c A B` and `git branch -m A C` in a scratch repository (git 2.x, macOS):

```txt
branch.A.aiddtask t
branch.B.aiddtask t                                  <- copy carries the key
B@{2026-10-01T08:00:00Z}                             <- and A's reflog, so A's creation time
Branch: copied refs/heads/A to refs/heads/B
C@{...} Branch: renamed refs/heads/A to refs/heads/C <- rename moves the key and the reflog
```

So a copied branch looks created when A was: the copy e2e below is red for the real reason, not for a creation time after the calls.

## Red: e2e, before any code change

`npx vitest run --project=e2e tests/e2e/telemetry-report-declaration.e2e.test.ts`

```txt
× does not give a copied branch the declaration of the branch it was copied from
  AssertionError: expected 3 to be 2
× does not bind a branch on a task set by hand with no declaration time
  AssertionError: expected { kind: 'value', key: 'by-hand', …(7) } to be undefined
× asks again after a rename, and one declaration covers the renamed branch
  AssertionError: expected 3 to be 2
Tests  3 failed | 1 passed (4)
```

The one passing is the legacy case (an unstamped declaration still attributes): green before, kept green by decision 3; its guard is a mutation below.

## Red: CLI unit and integration, before any code change

`npx vitest run` on the parse, attribution, source, store and forget specs:

```txt
× reads nothing from a task or a ticket with no declaration time
× reads nothing from a declaration made for another branch, as a copy or a rename leaves it
× tells a stamp apart from a branch whose name differs only in case
× keeps the declared branches when another one is not declared
× lets a snapshot with no declaration time attribute nothing: no command wrote it
× reads nothing from a declaration the command did not make on that branch
× writes the keys the reader reads back, stamped with the branch it was made on
× leaves a renamed or copied branch undeclared: git moves the keys, the stamp keeps the old name
× removes exactly those keys, and says how many
Tests  9 failed | 116 passed (125)
```

## Red: the shared fixture, both readers, before any code change

CLI, `npx vitest run tests/contexts/telemetry/telemetry-bindings-fixture.unit.test.ts`:

```txt
× reads task-without-declared-at as the fixture says
× reads stamped-for-another-branch as the fixture says
× reads stamp-without-declared-at as the fixture says
× binds branch-task-without-declared-at-is-unbound
× binds branch-stamped-for-another-branch-is-unbound
× binds branch-stamp-without-declared-at-is-unbound
Tests  6 failed | 107 passed (113)
```

Hook, `node --test scripts/__tests__/aidd-telemetry-hooks.test.js`:

```txt
✖ a branch declaration read back from real git follows the fixture
✖ binding follows the fixture, through real git and the shared files
✖ parseBranchConfig cuts the known suffix off a dotted branch name
✖ a branch the command did not declare is asked: a task set by hand, a declaration copied from another branch
ℹ tests 65  ℹ pass 61  ℹ fail 4
```

`the gate asks on every prompt until the branch is declared, then never again` passes before any change: it pins what the hook already does (M8, decision 6), and the doc is what changes.

## Green after the change

- `npx vitest run tests/contexts/telemetry`: `Tests  1223 passed (1223)` (with the e2e file above).
- `npx vitest run --project=e2e tests/e2e/telemetry`: `Test Files  8 passed (8)`, `Tests  76 passed (76)`.
- `node --test scripts/__tests__/aidd-telemetry-hooks.test.js`: `ℹ tests 65`, `ℹ fail 0`.

## Guards: each mutation turns its test red

Each mutation applied alone to the source, the named suite run, the file restored.

| # | Mutation | Suite | Red |
| --- | --- | --- | --- |
| M1 | `parseBranchConfig` keeps every branch (filter removed) | `vitest tests/contexts/telemetry` | 8+ tests, incl. `reads nothing from a task or a ticket with no declaration time` |
| M2 | stamp ignored (`declared_at !== null` only) | same | 7: `reads nothing from a declaration made for another branch…`, `binds branch-stamped-for-another-branch-is-unbound`, … |
| M2 | same | e2e declaration file | 2: copy, rename |
| M3 | `declared_at` not required | `vitest tests/contexts/telemetry` | 7: `reads nothing from a task or a ticket with no declaration time`, `binds branch-task-without-declared-at-is-unbound`, … |
| M3 | same | e2e declaration file | 0: the attribution guard (M6) still drops the snapshot. With M3 and M6 together: `× does not bind a branch on a task set by hand with no declaration time` |
| M4 | unstamped (legacy) rejected | `vitest tests/contexts/telemetry` | 8+: `still reads a declaration written before declarations were stamped`, … |
| M4 | same | e2e declaration file | 1: `still reads a declaration written before the branch was stamped` |
| M5 | store writes no `aiddDeclaredFor` | `vitest tests/contexts/telemetry` | 2: `writes the keys … stamped …`, `leaves a renamed or copied branch undeclared…` |
| M5 | same | e2e declaration file | 2: copy, rename |
| M6 | attribution keeps snapshots with no `declared_at` | `vitest tests/contexts/telemetry` | 1: `lets a snapshot with no declaration time attribute nothing…` |
| M7 | forget regex without `aidddeclaredfor` | same | 1: `removes exactly those keys, and says how many` |
| M8 | source regex without `declaredfor` | same | 2: `reads nothing from a declaration the command did not make on that branch`, rename/copy |
| H1 | hook: stamp ignored | `node --test …hooks.test.js` | 3: fixture via git, binding fixture, `a branch the command did not declare is asked…` |
| H2 | hook: `declared_at` not required | same | 3: same three |
| H3 | hook: legacy rejected | same | 3: fixture via git, binding fixture, `a bound branch, session or carried session passes` |
| H4 | hook regex without `declaredfor` | same | 3 |
| H5 | hook: `branchDeclaration` returns what it read, declared or not | same | 3 |

## Mutation (`pnpm test:mutation:telemetry`, under the lock)

- Run 1: `Report: reports/mutation/telemetry/ (score 96.3, floor 96)`. On changed lines, one survivor: `attribution.ts` `?? []` to `?? ["Stryker was here"]`, equivalent (a string is no snapshot of any generation, so the branch still binds nothing).
- The `?? []` was replaced by an explicit `if (snapshots === undefined) return null;`, which leaves no equivalent mutant.
- Run 2: `score 96.3, floor 96`. Mutants on the lines this change touches: `branch-binding.ts` 17 killed, `attribution.ts` 12 killed, store, source and forget adapters 1 killed each. None survived.

## Gates

| Gate | Shortest decisive line |
| --- | --- |
| `cd cli && pnpm test` | `Test Files  511 passed \| 1 skipped (512)`, `Tests  6668 passed \| 1 skipped (6669)` |
| `node --test 'scripts/__tests__/*.test.js'` | `ℹ tests 459`, `ℹ fail 0` |
| bundle budget | before: `693.2 KB / budget: 695 KB`; after: `693.6 KB / budget: 695 KB`, `OK: within budget` |
| `pnpm smoke` (`XDG_CONFIG_HOME`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR` temp, `GIT_CONFIG_NOSYSTEM=1`; the script moves `HOME` and `AIDD_USER_CONFIG_DIR`) | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%` |
| `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| same with `--attended` | `…; asked, answered by the hook, kept across /clear` |

## Review round 1 fixes

- Red first, `git-branch-binding-store-adapter.integration.test.ts`: `× declares again over a branch copied onto with -C, which leaves every key twice`, `Error: git config branch.feat/y.aiddTask failed`. Green after `--replace-all` / `--unset-all`: `Tests  13 passed (13)`.
- Probe: after `git branch -C x y` the config holds `[branch "y"]` twice, the copied section first; both readers kept the last value of a key. Round 2 showed this mixes the two declarations when the branch's own left a key unset (see below).
- Guards: plain set (S1) and plain unset (S2) each turn `declares again over a branch copied onto with -C…` red; the stamp mutation (M2) turns `asks again after a rename, and one declaration on the new name covers it` red (now checked on a call made on the renamed branch, `feat/c`).
- Gates on 703b646e: `cd cli && pnpm test` `Tests  6669 passed | 1 skipped (6670)`; `node --test 'scripts/__tests__/*.test.js'` `ℹ tests 459`, `ℹ fail 0`; bundle `693.5 KB / budget: 695 KB`; mutation `score 96.5, floor 96`, changed lines: `branch-binding.ts` 17, `binding-resolution.ts` 4, `attribution.ts` 15, store adapter 11, source and forget adapters 1 each, all killed; smoke `PASS: 132   FAIL: 0   SKIP: 1`; tokens end to end and `--attended`: same lines as above.

## Review round 2 fixes

- Red first: CLI `× reads nothing from a branch copied onto with -C, which lists a key twice`, `× reads nothing from a branch whose task alone is listed twice`, `× declares again over a branch copied onto with -C…`, `× reads copied-onto-a-branch-declared-none as the fixture says`, `× binds branch-copied-onto-a-declared-branch-is-unbound` (`Tests  5 failed | 1220 passed (1225)`); hook `✖ a branch declaration read back from real git follows the fixture`, `✖ binding follows the fixture…`, `✖ the gate asks on a branch copied onto with -C, whose keys are listed twice` (`ℹ fail 3`); e2e `× does not mix a declaration copied with -C into the one the branch already had`, `AssertionError: expected 3 to be 2`.
- Green: `Tests  1225 passed`, hook `ℹ fail 0`, e2e `Tests  5 passed (5)`.
- Guards: T1 (CLI ignores a key listed twice) turns 6 unit tests and the e2e red; T2 (`||=` to `=`) turns `reads nothing from a branch whose task alone is listed twice` red; HT1 (hook ignores it) turns 3 hook tests red; HT2 (`||=` to `=`) survived until the fixture case `task-listed-twice` was added, then `✖ a branch declaration read back from real git follows the fixture`.
- Gates on 0c5eab26: `cd cli && pnpm test` `Tests  6676 passed | 1 skipped (6677)`; `node --test 'scripts/__tests__/*.test.js'` `ℹ tests 460`, `ℹ fail 0`; bundle `693.6 KB / budget: 695 KB`; mutation `score 96.4, floor 96`, changed lines: `branch-binding.ts` 24, `attribution.ts` 15, store adapter 11, `binding-resolution.ts` 4, source and forget adapters 1 each, all killed; smoke `PASS: 132   FAIL: 0   SKIP: 1`; tokens end to end and `--attended`: unchanged lines.

Count note (round 3, S2): after the round 2 changes the CLI telemetry suites hold `Tests  1226 passed (1226)` and the hook suite `ℹ tests 66`, `ℹ fail 0`; the 1225 above was before the `task-listed-twice` fixture case.

## Review round 3 fixes

- Probe, dated git in a scratch repository: every way a branch takes a name writes one reflog subject, and the source's reflog comes along.

```txt
-C:      b@{2026-10-05T00:00:00Z} | Branch: copied refs/heads/a to refs/heads/b
         b@{2026-10-01T00:00:00Z} | branch: Created from main        <- a's creation
-M:      d@{2026-10-05T00:00:00Z} | Branch: renamed refs/heads/c to refs/heads/d
-D;-m:   f@{2026-10-05T00:00:00Z} | Branch: renamed refs/heads/e to refs/heads/f
-c;-m:   i@{2026-10-06T00:00:00Z} | Branch: renamed refs/heads/h to refs/heads/i
         i@{2026-10-05T00:00:00Z} | Branch: copied refs/heads/g to refs/heads/h
```

- Red first, e2e: `× lets a declaration on a branch copied onto with -C reach the report, the source older`, `× lets a declaration on a name renamed onto, after the old branch was deleted, reach the report`, both `AssertionError: expected undefined to be 1` (the new declaration's row is missing: its call went to `old-b`). Integration: `× is when the branch took its name, for a copy or a rename onto a name used before`. Unit tests red on the missing `branchCreatedAt` export.
- Green: `vitest tests/contexts/telemetry` `Tests  1229 passed (1229)`; `vitest --project=e2e tests/e2e/telemetry` `Tests  79 passed (79)`. The rename e2e now dates its rename (10-08) before the call it adds, as it happens in real use.
- Guards: R1 (always the oldest entry) turns both new e2e tests, the integration test and `takes the newest entry where the branch took its name…` red; R2 (copies not matched) turns the integration and that unit test red; R3 (any target name) turns `ignores an entry that moved another name, or that names this one only as a prefix` red.
- Mutation, first run after the fix: `score 96.4, floor 96`; one survivor on a changed line, `selectorTime` `endsWith("}")` to `endsWith("")`, which no test told apart (a selector missing its brace also lost the last digit of its time). A test with a valid time and another last character now kills it: `× is none for a selector without its closing brace` under that mutation.
- Gates on the final code: `cd cli && pnpm test` `Tests  6681 passed | 1 skipped (6682)`; `node --test 'scripts/__tests__/*.test.js'` `ℹ tests 460`, `ℹ fail 0`; bundle `694.0 KB / budget: 695 KB` (1.0 KB headroom left); mutation `score 96.4, floor 96`, changed lines: `branch-binding.ts` 72, `attribution.ts` 15, store adapter 11, `binding-resolution.ts` 4, source adapter 2, forget adapter 1, all killed; smoke `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; tokens end to end `2 calls, 393 tokens, all on task demo, ticket T-1, …` and with `--attended` `…; asked, answered by the hook, kept across /clear`.

## Review round 4 fixes

- Red first: `× reads the rename libgit2 writes, in lower case, as git's own` (`Tests  1 failed | 60 passed (61)`). Green: `vitest tests/contexts/telemetry` `Tests  1230 passed (1230)`. Guard: the case-sensitive `/^Branch: (renamed|copied) /` turns that test red.
- Gates on the final code: `cd cli && pnpm test` `Tests  6682 passed | 1 skipped (6683)`; `node --test 'scripts/__tests__/*.test.js'` `ℹ tests 460`, `ℹ fail 0`; bundle `694.0 KB / budget: 695 KB`; mutation `score 96.4, floor 96`, changed lines: `branch-binding.ts` 67, `attribution.ts` 15, store adapter 11, `binding-resolution.ts` 4, source adapter 2, forget adapter 1, all killed, none survived; smoke `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; tokens end to end `2 calls, 393 tokens, all on task demo, ticket T-1, …`, with `--attended` `…; asked, answered by the hook, kept across /clear`.

## Review round 5 fixes

- Red first: `× lets a newer generation with only a snapshot no command wrote attribute nothing, not the older one`, `AssertionError: expected { state: 'attributed', …(2) } to deeply equal { state: 'unattributed', …(1) }`. Green: `vitest tests/contexts/telemetry` `Tests  1231 passed (1231)`. Guard: letting the undeclared snapshots of the chosen generation speak turns it and 2 other attribution tests red.
- Gates on the final code: `cd cli && pnpm test` first run `Tests  2 failed | 6681 passed | 1 skipped (6684)`, failing tests not captured; two reruns `Tests  6683 passed | 1 skipped (6684)`. The two failures did not recur and are not identified. `node --test 'scripts/__tests__/*.test.js'` `ℹ tests 460`, `ℹ fail 0`; bundle `694.0 KB / budget: 695 KB`; mutation `score 96.4, floor 96`, changed lines: `branch-binding.ts` 67, `attribution.ts` 15, store adapter 11, `binding-resolution.ts` 4, source adapter 2, forget adapter 1, all killed; smoke `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`; tokens end to end and `--attended`: unchanged lines.
