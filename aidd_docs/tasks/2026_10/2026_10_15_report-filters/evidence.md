# Evidence

## Red runs

### Phase 1

`pnpm exec vitest run tests/contexts/telemetry/domain/report/report-filter.unit.test.ts`, against `report-filter.ts` holding only its types and axis lists:

```txt
× keeps every call when no flag is given
× keeps a call whose axis has exactly the value named, case and all
× are --unattributed with --task, --ticket or --absent ticket
× is the value equal to it, even when it also starts another
× keeps exactly the calls of that row, so it adds up to that row
TypeError: matchesFilter is not a function
TypeError: conflictsOf is not a function
TypeError: resolveId is not a function
Tests  15 failed (15)
```

#### Each guard, broken

Each mutation reverted after its run.

`--absent` keeping every call (`if (selector.kind === "absent") return true;`):

```txt
× keeps a call the axis has no value for under --absent, and only that call
× keeps a call only when every flag given keeps it
× keeps exactly the calls of that row, so it adds up to that row
Error: Property failed after 28 tests
```

`resolveId` without the exact match first:

```txt
× is the value equal to it, even when it also starts another
```

`--unattributed` occupying `task` only (`? ["task"] :`):

```txt
× are --unattributed with --task, --ticket or --absent ticket
× lists every pair, each in the order the flags are printed
```

`--unattributed any` matching one reason only (`selector.reason === "any" ||` removed):

```txt
× keeps work with no task by its reason, or by either under any
× keeps a call only when every flag given keeps it
```

### Phase 2

`pnpm exec vitest run tests/contexts/telemetry/application/report tests/presentation/display/telemetry`, before the use case took filters (the constructor ignored the locator and the refusal it was given):

```txt
report-envelope.unit > names what the report was narrowed to, every flag in a fixed order, as resolved
  AssertionError: expected [ 'version', 'period', 'axis', 'rows' ] to deeply equal [ 'version', 'period', 'axis', …(1) ]
report-usage-use-case.unit > narrowing a report > (13 cases)
  AssertionError: expected { status: 'reported', …(3) } to deeply equal { status: 'ambiguous', …(3) }
  AssertionError: expected { status: 'reported', …(3) } to deeply equal { status: 'not-a-repository' }
  Tests  14 failed | 19 passed (33)
report-filters.property > adds up to the row it selects, and every axis of it adds up to its totals
  Error: Property failed after 6 tests
  AssertionError: expected { records: 2, … } to deeply equal { records: 1, … }
report-window.property > prints the envelope of the full ledger filtered to its period and its filters, byte for byte, …
  Error: Property failed after 1 tests
telemetry-report-display.unit > names the flag and every id a start names, in full, when it names several
telemetry-report-display.unit > says `.` names no repository where the command runs
  TypeError: Cannot read properties of undefined (reading 'from')
```

Green before the change, by construction, so not red runs: "refuses under AIDD_TELEMETRY=0 before `.` runs git" (ingest refused first, and nothing ran `.`), and the AND property (a report that ignores every filter keeps the same calls whatever is combined).

#### Each guard, broken

The report's own refusal removed, leaving only ingest's:

```txt
× reads nothing and reports nothing under AIDD_TELEMETRY=0
× refuses under AIDD_TELEMETRY=0 before `.` runs git
AssertionError: expected { status: 'reported', …(4) } to deeply equal { status: 'refused' }
```

`matchesFilter` keeping a call when any filter keeps it (`.every(` to `.some(`):

```txt
× keeps the calls every one of its filters keeps alone
Error: Property failed after 1 tests
```

A start resolved among every call read, the day on each side of the period included (`resolvedIn(held.records, "session"`):

```txt
× prints the envelope of the full ledger filtered to its period and its filters, byte for byte, …
Error: Property failed after 29 tests
× resolves a start among the calls of the period only
AssertionError: expected { status: 'ambiguous', …(3) } to match object { status: 'reported', …(1) }
```

The unit case did not see this mutation at first: its out-of-period call sat outside the window read. It now sits on the day before the period, which the window reads to settle.

Acceptance 5 (`.` on a real repository, main tree and linked worktree) is proven against the built binary in phase 3, where ingest really stores the id: the use case's own cases use the locator port.

### Phase 3

`pnpm exec vitest run tests/presentation/commands/telemetry-wiring.integration.test.ts`, before the flags existed:

```txt
× asks for every day on the total axis when nothing is given, and prints text
  AssertionError: expected "vi.fn()" to be called with arguments: [ { axis: 'total', …(2) } ]
× passes every flag it is given, trimmed as a declaration is
  CommanderError: error: unknown option '--task'
× reads a bare --unattributed as either reason, and takes one reason
  CommanderError: error: unknown option '--unattributed'
× refuses ["--model","m","--absent","model"], which select on one axis, with exit 1 before reading anything
  CommanderError: error: unknown option '--model'
× exits 1 when the report cannot name what was asked: {"status":"not-a-repository"}
Tests  11 failed | 39 passed (50)
```

`pnpm exec vitest run tests/presentation/display/telemetry/telemetry-report-display.unit.test.ts`:

```txt
× names each filter as its row would label it, on one line before the table
  AssertionError: expected [ …(3) ] to deeply equal [ …(3) ]
× says no call matches when filters keep none, and still shows the coverage
  AssertionError: expected [ …(4) ] to deeply equal [ …(5) ]
Tests  2 failed | 19 passed (21)
```

`pnpm exec vitest run --project=e2e tests/e2e/telemetry-report.e2e.test.ts`, against the built binary:

```txt
× adds up to the row it selects, a session typed by the eight characters the text shows
  AssertionError: error: unknown option '--ticket'
× names with `.` the repository ingest stored, from the main tree and from a linked worktree
  AssertionError: error: unknown option '--repository'
× refuses a start two sessions share, naming both in full and sorted
× refuses flags on one axis with exit 1, naming the flag, and reads nothing
× refuses `.` outside any repository with exit 1, and reads nothing
× runs no git for `.` under AIDD_TELEMETRY=0
  AssertionError: expected 1 to be +0 // Object.is equality
Tests  7 failed | 18 passed (25)
```

`node --test scripts/__tests__/check-claude-tokens-end-to-end.test.js`:

```txt
✖ fails when the report narrowed to the task in this repository misses a call
✖ fails when `.` is not resolved to the repository's id
```

Green before the change, by construction, so not red runs: the refusals of a repeated flag, an empty value and an unknown choice (Commander refused the unknown option with exit 1, naming it). Each is proven a guard below.

#### Each guard, broken

The repeat check removed from the flag parser:

```txt
× refuses an open flag given twice with exit 1, naming the flag, before reading anything
× refuses a closed flag given twice with exit 1, naming the flag, before reading anything
× refuses a bare flag given twice with exit 1, naming the flag, before reading anything
```

An empty value passed through (`if (text === null) return value;`):

```txt
× refuses a value empty once trimmed with exit 1, naming the flag, before reading anything
```

The choice check removed:

```txt
× refuses an agent no call can have with exit 1, naming the flag, before reading anything
× refuses an axis no call lacks with exit 1, naming the flag, before reading anything
× refuses a reason no call has with exit 1, naming the flag, before reading anything
```

The conflict check skipped (`if (false)`):

```txt
× refuses ["--unattributed","--task","a"], which select on one axis, with exit 1 before reading anything
× refuses ["--ticket","T","--unattributed","no-binding"], ...
× refuses ["--absent","ticket","--unattributed"], ...
× refuses ["--model","m","--absent","model"], ...
```

### Phase 4

The one assertion added in this phase, the ambiguity message for a repository, was written after mutation found the case uncovered (`"repositories"`: NoCoverage; `flag === "session"` to `true`: Survived). Both are killed in the second run below.

## Gates

| Gate | Command | Decisive line |
| --- | --- | --- |
| CLI suite | `cd cli && pnpm test` | `Tests  6575 passed \| 1 skipped (6576)` |
| Telemetry mutation | `pnpm test:mutation:telemetry` | first run `score 96.5, floor 96`; after the added test `score 96.2, floor 96` |
| Build and bundle budget | `pnpm build` | `Bundle size: 689.2 KB / budget: 695 KB` |
| Smoke | `bash scripts/smoke-tools.sh` against the build, in a relocated HOME | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%` |
| Tokens end to end | `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| Tokens end to end, attended | same, `--attended` | `…, and on task demo in this repository; asked, answered by the hook, kept across /clear` |
| Pre-commit | `pnpm exec lefthook run pre-commit` | every job `✔️`, `cli-architecture`, `cli-biome`, `cli-typecheck`, `scripts-tests` included |
| Pre-push | `pnpm exec lefthook run pre-push` | `✔️ cli-knip`, `✔️ cli-test` (`Tests  6575 passed \| 1 skipped (6576)`) |

Smoke and both token checks ran through a script setting `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR` and `CLAUDE_CONFIG_DIR` to a fresh temp directory, with `GIT_CONFIG_NOSYSTEM=1`. The e2e tests, the help golden update and `cli-test` ran the build through `tests/e2e/helpers.ts`, which relocates `HOME`, `XDG_CONFIG_HOME` and `AIDD_USER_CONFIG_DIR` (the report e2e also sets `AIDD_TELEMETRY_DIR` and `CLAUDE_CONFIG_DIR`, and its git runs under `sandboxGitEnv`), but does not set `GIT_CONFIG_NOSYSTEM` for the binary.

Between the two runs, survived and uncovered mutants in the four report files this change writes went from 13 to 10, so the drop from 96.5 to 96.2 lies in other files; the runs were not compared file by file, and the second overwrote the first report.

### Surviving mutants on changed lines

All equivalent:

| Where | Mutant | Why nothing can kill it |
| --- | --- | --- |
| `report-usage-use-case.ts:158` | `typed === null` to `false` | `resolveId(null, …)` finds no id equal to `null` nor starting with `"null"`, returns `none`, and `{ id: typed }` is `{ id: null }` again |
| `report-filter.ts:81` | the selector's `kind: "unattributed"` to `""` | `selects` tests `value`, then `absent`, and treats every other kind as unattributed |
| `report-filter.ts:87` | `value.kind === "value"` to `true` | a row value of another kind has no `value`, so `value.value === selector.value` is false all the same |
| `telemetry-report-display.ts:66` | `kind: "value"` to `""` | `labelOf` tests `absent`, then `unattributed`, and labels every other kind as a value |
| `telemetry-report-display.ts:73` | `labelOf("task", …)` to `labelOf("", …)` | for an unattributed value `labelOf` reads only the reason; the axis matters for `absent` and for truncating a session or repository |

The other survivors in the touched files (`telemetry-report-display.ts:111`, `:122`, `:189`) are on lines this change did not write.

## Review round 1

Tests first, against the code of `6651b9f7`:

```txt
report-usage-use-case.unit > refuses flags that select on one axis, before refusal and before anything is read
  AssertionError: expected { status: 'reported', …(4) } to deeply equal { status: 'conflicting', …(2) }
report-usage-use-case.unit > names the repository a directory is in for `.`, … (and the five other `.` cases, now given as `here`)
  AssertionError: expected { status: 'reported', …(4) } to deeply equal { status: 'not-a-repository' }
telemetry-wiring.integration > asks for the repository the command runs in for `.`
  AssertionError: expected { task: null, ticket: null, …(7) } to deeply equal { task: null, ticket: null, …(8) }
telemetry-wiring.integration > refuses a bare flag given twice by its name, not by the value it was preset to
  AssertionError: expected 'error: option \'--unattributed [reaso…' to contain '--unattributed is given twice: give i…'
telemetry-report-display.unit > names the two flags that select on one axis, with the axis --absent names
  TypeError: Cannot read properties of undefined (reading 'from')
Tests  10 failed | 128 passed (138)
check-claude-tokens-end-to-end > passes when `.` names a repository with no hosted origin by its root commit
  ✖ fail 1
```

The selection line now reads `selectorsOf`, the list the filter matches with: a refactor, green before and after (the display's selection cases are unchanged).

### Gates after the review

| Gate | Decisive line |
| --- | --- |
| `cd cli && pnpm test` | `Tests  6578 passed \| 1 skipped (6579)` |
| `pnpm test:mutation:telemetry` | `score 96.3, floor 96` |
| `pnpm build` | `Bundle size: 689.4 KB / budget: 695 KB` |
| tokens end to end | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository` |
| tokens end to end, `--attended` | same, then `; asked, answered by the hook, kept across /clear` |

Survivors on changed lines: `report-usage-use-case.ts:168` (`typed === null` to `false`) and `report-filter.ts:92` (`value.kind === "value"` to `true`), both equivalent as explained above. The two earlier equivalents on the selector's and the label's `kind` are gone with the `unattributed-any` selector and `selectorsOf`. The other survivors in the touched files (`telemetry-report-display.ts:112`, `:123`, `:194`) are on lines this change did not write.

## Review round 2

Tests first, against `c790dd82`:

```txt
telemetry-wiring.integration > exits 1 on ["--model","m","--absent","model"], which select on one axis, naming both as the report refuses them (and the three other pairs)
  AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
  Tests  4 failed | 47 passed (51)
pnpm typecheck
  report-usage-use-case.unit.test.ts(528,5): error TS2578: Unused '@ts-expect-error' directive.
```

The command no longer checks the flags itself: the use case's `conflicting` result is the one refusal, still before refusal and before anything is read (`report-usage-use-case.unit.test.ts`, and the e2e "flags on one axis" case, which checks the telemetry directory is unchanged). `RequestedFilters` is a union: `here` comes only with `repository: null`, and a repository typed beside it does not compile.

| Gate | Decisive line |
| --- | --- |
| `cd cli && pnpm test` | `Tests  6579 passed \| 1 skipped (6580)` |
| telemetry mutation | not rerun: the only mutated file changed, `report-usage-use-case.ts`, changed a type alone, which holds no mutant; the command is outside the scope. Last score `96.3` |
