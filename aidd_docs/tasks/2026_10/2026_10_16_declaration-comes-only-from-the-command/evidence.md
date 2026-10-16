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
