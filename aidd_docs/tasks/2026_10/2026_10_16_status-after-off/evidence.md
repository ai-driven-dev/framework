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
