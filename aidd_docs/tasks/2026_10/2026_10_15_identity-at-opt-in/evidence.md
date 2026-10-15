# Evidence

## Red runs

### Phase 1

`pnpm exec vitest run tests/contexts/telemetry/application/switch/telemetry-switch-use-cases.unit.test.ts tests/contexts/telemetry/application/identity/propose-identity-use-case.unit.test.ts tests/contexts/telemetry/infrastructure/identity/git-user-source-adapter.integration.test.ts`, before the choice, the proposal and the git user source exist:

```txt
× writes the identity chosen once the clone is on, and names it
  AssertionError: expected null to be 'Ada Example'
× replaces the identity already set, and names the previous one
  AssertionError: expected 'Ada at Home' to be 'Ada Example'
× refuses an identifier the identity rules refuse, before writing anything
  AssertionError: expected { status: 'on', …(5) } to deeply equal { status: 'refused', …(1) }
× refuses to stay anonymous while an identity is set, before writing anything
  AssertionError: expected { status: 'on', …(5) } to deeply equal { status: 'refused', …(1) }
× stays anonymous when nobody is named, and writes no identity
× keeps the identity as it is, and names it
  AssertionError: expected { status: 'on', …(5) } to match object { identity: { …(2) } }
FAIL propose-identity-use-case.unit.test.ts
  Error: Cannot find module '…/application/identity/propose-identity-use-case.js'
FAIL git-user-source-adapter.integration.test.ts
  Error: Cannot find module '…/infrastructure/identity/git-user-source-adapter.js'
Tests  6 failed | 44 passed (50)
```

Green before the change, by construction, so not a red run: "writes no identity when the clone is refused, whatever was chosen" and "writes no identity when the consent log cannot be trusted" (today's use case writes no identity at all). Both are proven guards by the mutation below.

`pnpm exec vitest run tests/presentation/display/telemetry/telemetry-lifecycle-display.unit.test.ts`, before the two refusals have words:

```txt
× refuses an identity it cannot keep, and says nothing changed
  AssertionError: expected undefined to be 'An identity is one line of at most 12…'
× sends a person who wants to stay anonymous to removing the identity first
  AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion
Tests  2 failed | 19 passed (21)
```

#### Guards

Each mutation reverted after its run.

The identity written before the clone is checked (the write moved above `readCloneConsent`):

```txt
× writes no identity when the clone is refused, whatever was chosen
× writes no identity when the consent log cannot be trusted
Tests  2 failed | 48 passed (50)
```

`none` never refused while an identity is set (`previous === "never"`):

```txt
× refuses to stay anonymous while an identity is set, before writing anything
Tests  1 failed | 49 passed (50)
```

The proposal no longer short-circuited under `AIDD_TELEMETRY=0`:

```txt
× is nothing under AIDD_TELEMETRY=0, and git is not asked
Tests  1 failed | 7 passed (8)
```

The git user source asking the email first:

```txt
× is the name, before the email
Tests  1 failed | 12 passed (13)
```

### Phase 2

`pnpm exec vitest run tests/presentation tests/contexts/telemetry/application/telemetry-status-use-case.unit.test.ts tests/contexts/telemetry/telemetry-lifecycle.integration.test.ts`, before the command asks and the displays name the person:

```txt
× turns measurement on in the directory it was run from, without asking, with --yes and a choice
  CommanderError: error: unknown option '--anonymous'
× names the person given with --as
  CommanderError: error: unknown option '--as'
× refuses --yes with no identity set and no choice, before anything is written
  AssertionError: expected null to be 1
× offers the proposal, another identifier, or anonymity, and names the one chosen
  TypeError: Cannot read properties of undefined (reading 'map')
× offers no proposal when there is none / takes another identifier, typed / stays anonymous when chosen
× asks nothing about the person when a flag answered / exits 1 when it is refused
× refuses --as with --anonymous, before asking anything
× refuses an identifier the identity rules refuse, before asking anything
× says the person axis shows anonymous when nobody is named
  AssertionError: expected 'No identity is set: the person axis s…' to contain 'shows "anonymous"'
× says last who the measurement names, whatever the work is bound to
  AssertionError: expected [ …(2) ] to have a length of 3 but got 2
× says who the clone is measured as, before the next step
  AssertionError: expected 'That setting is shared by this clone\…' to be 'Measured anonymously: the person axis…'
× says what an absent value is on each axis   (person: "anonymous")
× names the person the measurement names, or nobody
  AssertionError: expected { status: 'shown', …(5) } to match object { status: 'shown', personId: null }
Tests  17 failed | 630 passed (647)
```

`pnpm exec vitest run --project=e2e tests/e2e/telemetry-lifecycle.e2e.test.ts tests/e2e/telemetry-report.e2e.test.ts`, the built binary before the change (every caller now passes `--anonymous`, which it does not know):

```txt
× refuses --yes with no identity set and no choice, and writes nothing
  AssertionError: expected +0 to be 1
× names the person given with --as, in on and in status, and keeps them on the next on
× refuses to stay anonymous while an identity is set, pointing to identity --off
  AssertionError: expected 'error: unknown option \'--anonymous\'…' to contain 'aidd telemetry identity --off'
× stays anonymous with --anonymous, stores no choice, and says how to be named
× turns on under AIDD_TELEMETRY=0 as before, when the choice is given
× shows the person axis as anonymous until an identity is chosen
… and every test whose setup runs `on --yes --anonymous`
Tests  23 failed | 3 passed (26)
```

Green before the change, so not a red run: "the identifier offered at on > is not read from git under AIDD_TELEMETRY=0" (the wiring landed in phase 1); proven a guard below.

#### Guards

Each mutation reverted after its run, against `tests/presentation/commands/telemetry-wiring.integration.test.ts` unless named.

`--yes` with no identity and no choice no longer refused (`if (options.yes) return null;` removed):

```txt
× refuses --yes with no identity set and no choice, before anything is written
Tests  1 failed | 44 passed (45)
```

`--as` not checked against the identity rules before asking:

```txt
× refuses an identifier the identity rules refuse, before asking anything
Tests  1 failed | 44 passed (45)
```

`--as` with `--anonymous` let through:

```txt
× refuses --as with --anonymous, before asking anything
Tests  1 failed | 44 passed (45)
```

An identity already set not kept (`=== "never"`):

```txt
× keeps the identity already set when --yes is given no choice, and asks nothing
× asks nothing about the person when an identity is set
Tests  2 failed | 43 passed (45)
```

The composition root giving the proposal `false` instead of the environment's refusal, against `tests/contexts/telemetry/telemetry-lifecycle.integration.test.ts`:

```txt
× is not read from git under AIDD_TELEMETRY=0
Tests  1 failed | 29 passed (30)
```

#### Green

`cd cli && pnpm test`, after phase 2:

```txt
Test Files  505 passed | 1 skipped (506)
     Tests  6553 passed | 1 skipped (6554)
```
