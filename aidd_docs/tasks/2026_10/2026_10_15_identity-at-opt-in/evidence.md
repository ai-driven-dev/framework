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

### Phase 3: gates

Every run of the built binary was sandboxed: `pnpm smoke` relocates `HOME` and sets `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR` itself, and was given a temporary `XDG_CONFIG_HOME` and `GIT_CONFIG_NOSYSTEM=1`; `check-claude-tokens-end-to-end.cjs` builds its own temporary home.

`pnpm smoke` (builds first, so the bundle budget runs with it):

```txt
Bundle size: 686.2 KB / budget: 695 KB
=== telemetry (sandboxed profile) ===
  ✓ telemetry on
PASS: 132   FAIL: 0   SKIP: 1   ·   coverage 100%
```

`node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js`, exit 0:

```txt
2 calls, 393 tokens, all on task demo, ticket T-1
```

`node scripts/check-claude-tokens-end-to-end.cjs --attended cli/dist/cli.js`, exit 0:

```txt
2 calls, 393 tokens, all on task demo, ticket T-1; asked, answered by the hook, kept across /clear
```

`pnpm knip`: no finding.

`pnpm test:mutation:telemetry` (49 minutes, run alongside the other gates):

```txt
3998 mutants, 136 survived, 28 timed out
Report: reports/mutation/telemetry/ (score 96.2, floor 96)
```

No mutant survives on a line this change added or modified: the survivors in the files it touched are on lines it left alone (`telemetry-on-use-case.ts` 153 and 155, inside `grant`; `telemetry-lifecycle-display.ts` 149, 167, 168, the forget listing; `telemetry-report-display.ts` 91, 102, 149; `person-identity.ts` 22). The new files (`propose-identity-use-case.ts`, `git-user-source-adapter.ts`) have every mutant killed: 6 of 6 and 13 of 13.

`pnpm exec lefthook run pre-commit`: every command green (`cli-architecture`, `cli-biome`, `cli-typecheck`, `markdown-links`, `scripts-tests`, …), `summary: (done in 38.91 seconds)`.

`pnpm exec lefthook run pre-push`, which runs the whole CLI suite (`cd cli && pnpm test`):

```txt
Test Files  505 passed | 1 skipped (506)
     Tests  6553 passed | 1 skipped (6554)
✔️ cli-knip
✔️ cli-test
```

## Review round 1 fixes

### Red run

`pnpm exec vitest run tests/presentation/display tests/presentation/commands/telemetry-wiring.integration.test.ts`, before the refusal says "non-empty", before the command prints it through `printOnResult`, and before a typed identifier is asked again:

```txt
× explains what an identity is when one is refused
  AssertionError: expected 'An identity is one line of at most 12…' to be 'An identity is one non-empty line of …'
× refuses an identity it cannot keep, and says nothing changed
  AssertionError: expected 'An identity is one line of at most 12…' to be 'An identity is one non-empty line of …'
× refuses an identifier the identity rules refuse, before asking anything
  AssertionError: expected 'Error: An identity is one line of at …' to contain 'An identity is one non-empty line of …'
× takes another identifier, typed
  AssertionError: expected 'Identifier (one line, at most 128 cha…' to be 'Identifier (one non-empty line, at mo…'
× asks again until the identifier typed is one it can keep
  AssertionError: expected "vi.fn()" to be called 3 times, but got 1 times
Tests  5 failed
```

### Guard

The typed identifier taken without checking it (`return { set: typed };`), reverted after the run:

```txt
× asks again until the identifier typed is one it can keep
Tests  1 failed | 45 passed (46)
```

### Gates

- `cd cli && pnpm test`: `Test Files 505 passed | 1 skipped (506)`, `Tests 6554 passed | 1 skipped (6555)`.
- `pnpm smoke`, sandboxed as before: `Bundle size: 686.3 KB / budget: 695 KB`, `PASS: 132   FAIL: 0   SKIP: 1`.
- `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js`, exit 0: `2 calls, 393 tokens, all on task demo, ticket T-1`.
- Same with `--attended`, exit 0: `… asked, answered by the hook, kept across /clear`.
- `pnpm test:mutation:telemetry`, on the final code: `Report: reports/mutation/telemetry/ (score 96.2, floor 96)`. The one changed line in its scope (`telemetry-lifecycle-display.ts` 25-26, the refusal text) has no survivor; the file's survivors are the same untouched forget-listing lines as before, shifted by one (150, 168, 169). `commands/telemetry.ts` is in the `presentation` scope; its loop is proven by the guard above.

## Review round 2 fixes

`pnpm exec vitest run tests/presentation/commands/telemetry-wiring.integration.test.ts`, before a refused typed identifier is explained before it is asked again:

```txt
× asks again until the identifier typed is one it can keep
  AssertionError: expected [ '' ] to have a length of 3 but got 1
Tests  1 failed | 45 passed (46)
```

Green after: `tests/presentation`, `Tests  610 passed (610)`.

Guard: with `printIdentityRule(output);` removed from the loop, `× asks again until the identifier typed is one it can keep`, `Tests  1 failed | 45 passed (46)`; reverted.

## After merging origin/next (report filters)

Merge `612f7019`. The three conflicts kept both sides (the `on` identity question beside the filter options, both public modules, both rows of the map). `report-display` test from `origin/next` expected `Selected: person = not set`, red on the merged tree as `AssertionError: expected 'Selected: person = anonymous' to be 'Selected: person = not set'`; aligned on `anonymous`.

Every run of the built binary was sandboxed: `HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR` in fresh temp directories, `GIT_CONFIG_NOSYSTEM=1`.

- `cd cli && pnpm test`: `Test Files  507 passed | 1 skipped (508)`, `Tests  6621 passed | 1 skipped (6622)`.
- `pnpm exec lefthook run pre-commit` (on the merge commit): every command green, `scripts-tests` included.
- `pnpm exec lefthook run pre-push`: the first run, beside the mutation run, failed 3 tests (`Tests 3 failed | 6618 passed`) and was not kept; rerun green, `✔️ cli-knip`, `✔️ cli-test`; the direct `pnpm test` above is green.
- `pnpm smoke`: `Bundle size: 692.8 KB / budget: 695 KB`, `PASS: 132   FAIL: 0   SKIP: 1`.
- `pnpm test:mutation:telemetry`: `Report: reports/mutation/telemetry/ (score 96.6, floor 96)`; no `Survived` or `NoCoverage` mutant on a line this branch changes against `origin/next`.
- `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js`, exit 0: `2 calls, 393 tokens, all on task demo, ticket T-1, and on task demo in this repository`.
- Same with `--attended`, exit 0: `… ; asked, answered by the hook, kept across /clear`.
- Identity set at `on`, then filtered (one seeded call): `on --yes --as "Ada Example"` printed `Measured as "Ada Example".`; `report --axis person --person "Ada Example"` printed `Selected: person = Ada Example` and the row `Ada Example 100 7 11 13 131`, JSON rows `[["value","Ada Example",1]]`; `report --axis person --absent person` printed `Selected: person = anonymous` and `No call in this period matches these filters.`, JSON rows `[]`.
