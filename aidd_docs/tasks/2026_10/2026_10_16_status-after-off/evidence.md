# Evidence

## Red runs

`pnpm exec vitest run tests/contexts/telemetry/domain/telemetry-consent.unit.test.ts tests/contexts/telemetry/application/telemetry-status-use-case.unit.test.ts tests/contexts/telemetry/application/declare-task-use-case.unit.test.ts tests/presentation/display/telemetry-display.unit.test.ts`, before `turnedOff`, `turned-off` and its words exist:

```txt
× is one whose key is off, as `aidd telemetry off` writes it
× is not one whose key is null / "2" / "2:t" / "true" / "{}" / "OFF" / " off" / "off " / ""
× is not one whose git config cannot be read
  TypeError: turnedOff is not a function
× explains each refusal
  AssertionError: expected undefined to be 'Measurement was turned off in this cl…'
× explains a refusal
  AssertionError: expected [ undefined ] to deeply equal [ Array(1) ]
× says a clone turned off was turned off, even with a log that cannot be read
  AssertionError: expected { status: 'refused', …(1) } to deeply equal { status: 'refused', …(1) }
× refuses a clone turned off as turned off, and writes nothing
  AssertionError: expected { status: 'refused', …(1) } to deeply equal { status: 'refused', …(1) }
Tests  15 failed | 57 passed (72)
```

Green before the change, by construction: "never says a clone with no key, or a key that grants nothing, was turned off" (today nothing is ever `turned-off`). Proven a guard by M1, M2 and M4 below.

`pnpm exec vitest run tests/e2e/telemetry-lifecycle.e2e.test.ts -t "turned off"`:

```txt
× says, after on then off, that measurement was turned off and how to turn it back on
AssertionError: expected 'Not measured: this clone has not run …' to contain 'Not measured: measurement was turned …'
Tests  1 failed | 11 skipped (12)
```

The never-on assertions before it passed: the clone that never ran `on` keeps today's words.

## Existing tests

No existing `no-consent` assertion seeds the key `off`, so none flipped. `consentOf` is unchanged: the fixture the hooks share (`scripts/__tests__/fixtures/telemetry-bindings/expected.json`, `"off": "absent"`) still holds. The `no-consent` declare refusal is now pinned to its exact words instead of `toContain`.

## Mutations

Each applied by hand to the source, the four unit files above run, then reverted:

```txt
## M1 turnedOff ignores the value: 14 red
   × is not one whose key is null
   × is not one whose key is "2"
   × is not one whose key is "2:t"
   × is not one whose key is "true"
   × is not one whose key is "{}"
   × is not one whose key is "OFF"
   × is not one whose key is " off"
   × is not one whose key is "off "
   × is not one whose key is ""
   × refuses like a declaration does
   × never says a clone with no key, or a key that grants nothing, was turned off
   × refuses a project that has not opted in, and writes nothing
   × refuses a clone with no consent, and one whose git config cannot be read, differently
   × refuses a key that names no interval open for the clone, and a damaged log
## M2 turnedOff ignores the kind: 15 red
   × is not one whose key is null
   × is not one whose key is "2"
   × is not one whose key is "2:t"
   × is not one whose key is "true"
   × is not one whose key is "{}"
   × is not one whose key is "OFF"
   × is not one whose key is " off"
   × is not one whose key is "off "
   × is not one whose key is ""
   × is not one whose git config cannot be read
   × refuses like a declaration does
   × never says a clone with no key, or a key that grants nothing, was turned off
   × refuses a project that has not opted in, and writes nothing
   × refuses a clone with no consent, and one whose git config cannot be read, differently
   × refuses a key that names no interval open for the clone, and a damaged log
## M3 off key reads no-consent: 2 red
   × says a clone turned off was turned off, even with a log that cannot be read
   × refuses a clone turned off as turned off, and writes nothing
## M4 any absent key reads turned-off: 5 red
   × refuses like a declaration does
   × never says a clone with no key, or a key that grants nothing, was turned off
   × refuses a project that has not opted in, and writes nothing
   × refuses a clone with no consent, and one whose git config cannot be read, differently
   × refuses a key that names no interval open for the clone, and a damaged log
## M5 turned-off decided after the log: 2 red
   × says a clone turned off was turned off, even with a log that cannot be read
   × refuses a key that names no interval open for the clone, and a damaged log
## M6 status words say has not run: 1 red
   × explains a refusal
## M7 task words say not opted in: 1 red
   × explains each refusal
```

## Gates

| Gate | Decisive line |
| --- | --- |
| `cd cli && pnpm test` | `Tests  6636 passed \| 1 skipped (6637)`, exit 0 |
| `pnpm exec lefthook run pre-commit` (on commit 519ec045) | `✔️ cli-architecture`, `cli-biome`, `cli-type-honesty`, `cli-typecheck`, `markdown-links`, `scripts-tests`, `commitlint`: all green |
| `pnpm exec lefthook run pre-push` | first run: `golden-baseline.e2e.test.ts > snapshot is deterministic` timed out at 60000 ms (machine shared with another agent; the same test passed in `pnpm test` above, and nothing here touches it). Second run: `Tests  6636 passed \| 1 skipped (6637)`, `✔️ cli-knip`, `✔️ cli-test`, exit 0 |
| `pnpm smoke` (sandboxed) | `PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%`, exit 0 |
| Bundle budget | `Bundle size: 693.1 KB / budget: 695 KB` (692.8 KB before) |
| `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` (sandboxed) | `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository`, exit 0 |
| same, `--attended` | `…; asked, answered by the hook, kept across /clear`, exit 0 |
| `pnpm test:mutation:telemetry` | `score 96.3, floor 96` |

### Mutants on changed lines

`consented-repositories.ts` lines 45 to 46: 9 mutants, all killed. `telemetry-consent.ts` lines 49 to 50: 9 mutants, 8 killed. The survivor is equivalent: `reading.kind === "value"` replaced by `true` leaves `reading.value === CONSENT_WITHDRAWN`, and an unreadable reading has no `value`, so `undefined === "off"` is still `false`. The kind test is there for the type checker's narrowing only. `telemetry-display.ts` is outside the telemetry mutation scope; its two new strings are pinned by exact `toBe`/`toEqual` (M6, M7).

## Docs grep

`git grep -n "Not measured\|has not opted in\|has not run" -- ':!aidd_docs/tasks' ':!cli/aidd_docs/tasks'`: the old words appear only in `telemetry-display.ts` and its tests, and in test names. No skill, hook, README or memory quotes them. The usage contract's consent section gains one line on the key `off`.

## Sandboxed repro

Built `cli/dist/cli.js`, three fresh clones in a `mktemp -d` sandbox (HOME, XDG_CONFIG_HOME, AIDD_USER_CONFIG_DIR, AIDD_TELEMETRY_DIR, CLAUDE_CONFIG_DIR inside it, `GIT_CONFIG_NOSYSTEM=1`): `never` never runs `on`, `on` runs `on --yes --anonymous`, `off` runs `on --yes --anonymous` then `off`.

Before:

```txt
-- off: Measurement is off for this clone. What was measured stays until `aidd telemetry forget --yes`.
== never: status
Not measured: this clone has not run `aidd telemetry on`.
== on: status
This clone is measured since 2026-10-16.
Nothing is bound: the default branch master, which is never bound. Declare with `aidd telemetry task <name>`.
Measured anonymously. To be named, run `aidd telemetry identity <id>`.
== off: status
Not measured: this clone has not run `aidd telemetry on`.
== off: task
Error: This clone has not opted in to measurement, so no task was declared. Run `aidd telemetry on` here first.
exit=1
== off: git key = off
```

After:

```txt
-- off: Measurement is off for this clone. What was measured stays until `aidd telemetry forget --yes`.
== never: status
Not measured: this clone has not run `aidd telemetry on`.
== on: status
This clone is measured since 2026-10-16.
Nothing is bound: the default branch master, which is never bound. Declare with `aidd telemetry task <name>`.
Measured anonymously. To be named, run `aidd telemetry identity <id>`.
== off: status
Not measured: measurement was turned off in this clone. Run `aidd telemetry on` to measure it again.
== off: task
Error: Measurement was turned off in this clone, so no task was declared. Run `aidd telemetry on` here to measure it again.
exit=1
== off: git key = off
```

## Review round 1 fixes

Both minor findings of `review.md` round 1, fixed in `f0f30ac3`. Contract Rule 3, the plan and the usage contract now say a key `off` reads `turned-off` only once the consent log is read and the clone identified; otherwise `unreadable-consent`, because `on` would refuse there.

### Red run

`pnpm exec vitest run tests/contexts/telemetry/application/telemetry-status-use-case.unit.test.ts tests/contexts/telemetry/application/declare-task-use-case.unit.test.ts`, before the change:

```txt
× says a clone turned off cannot be read, not to run on, when on would refuse
AssertionError: expected { status: 'refused', …(1) } to deeply equal { status: 'refused', …(1) }
Tests  1 failed | 27 passed (28)
```

`"{}"` in the never-opted-in loop is green by construction: it was already `no-consent`. G4 below proves it a guard.

### Guard breaks

Each applied to the source, the two files above run, then reverted:

```txt
## G1 turned-off decided before the log again: 1 red
   × says a clone turned off cannot be read, not to run on, when on would refuse
## G2 an off key reads no-consent: 3 red
   × says a clone turned off was turned off
   × says a clone turned off cannot be read, not to run on, when on would refuse
   × refuses a clone turned off as turned off, and writes nothing
## G3 the turned-off answer is skipped: 2 red
   × says a clone turned off was turned off
   × refuses a clone turned off as turned off, and writes nothing
## G4 a key {} reads turned off: 2 red
   × refuses like a declaration does
   × never says a clone with no key, or a key that grants nothing, was turned off
```

### Gates

| Gate | Decisive line |
| --- | --- |
| `cd cli && pnpm test` | `Tests  6637 passed \| 1 skipped (6638)`, exit 0 |
| lefthook pre-commit (on `f0f30ac3`) | `cli-architecture`, `cli-biome`, `cli-type-honesty`, `cli-typecheck`, `markdown-links`, `scripts-tests`, `commitlint`: all `✔️` |
| lefthook pre-push | `Tests  6637 passed \| 1 skipped (6638)`, `✔️ cli-knip`, `✔️ cli-test`, exit 0 |
| `pnpm test:mutation:telemetry` | `score 96.3, floor 96` |

Mutants on changed lines: `consented-repositories.ts` 15 of 15 killed. `telemetry-consent.ts` lines 49 to 50: 8 of 9 killed. The survivor is the same equivalent mutant as before (`reading.kind === "value"` replaced by `true`).
