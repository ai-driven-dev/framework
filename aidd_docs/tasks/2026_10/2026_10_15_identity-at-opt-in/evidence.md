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
