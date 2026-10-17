---
status: changes-requested
---

# Review: One call, one key; one repository, one id (round 3)

Head `429948a3`, base `origin/next`. Independent check, read-only on the code. Round 2 (86/100, head `a06f9857`) is superseded by this report.

**Verdict: changes requested, minors only. Score 90/100.**

No deal breaker. n2 to n5 hold. n1 is documented, but the window property's exemption is wider than the limit it names: it also hides a bounded report that *loses* a call, which the limit does not allow. A hand mutation of that kind survives half the runs. The PR description still contradicts the new limit in two sentences. Its "98.8, one equivalent survivor" Stryker claim is unrecorded and not reproduced: a non-equivalent mutant of the D1 trigger survives a run.

## Deal breakers

None.

## Round 2 findings, re-checked

| # | Claim | Status | Evidence |
| --- | --- | --- | --- |
| n1 | limit stated, claims qualified | fulfilled | `contract.md` Read-time row, older-CLI paragraph, new Limits row; `usage-contract.md` Key row, window paragraph, `repository-ids.json` row |
| n1 | window property generates older-CLI requestless lines | partial | generated and red run recorded (evidence.md). Exemption too wide: see r1 |
| n2 | six stale statements | fulfilled | `usage-contract.md` :59, :127, :164; `usage-ledger-adapter.ts:42-43` (header); `telemetry.md:55`; `contract.md` flowchart and Limits row now cite 1,672 ms vs 13 ms |
| n3 | one `ADVISOR` pattern, `#advisor10` pinned | fulfilled | `claude-transcript-usage.ts:16`, imported by `legacy-usage-key.ts:1`; tests at `claude-transcript-usage.unit.test.ts:334`, `legacy-usage-key.unit.test.ts:19` |
| n3 | guard deleted, no behaviour change | fulfilled | `stored-usage-migration.ts:29-38`: complete table, `pending: []` => `roots = []` (`[] ?? …` keeps `[]`), `locate([])` spawns no git, `ids.size === table.ids.size`, `0 < 0` false => return, zero writes. Idempotence and per-ingest cost unchanged. Only cost added: none (one `load()` was already there) |
| n4 | migration property with `unreadable`/`gone`; failing retry writes | fulfilled | `stored-usage-migration.property.integration.test.ts:148-156, 321-325`; `stored-ids-and-keys.integration.test.ts:250`. Mutation M1-h reproduced: killed (below) |
| n5 | one-line rationale | fulfilled | `usage-ledger-adapter.ts:65`, `resolution-store-adapter.ts:22` |

Earlier rounds, no regression: the `cli/src` diff since `a06f9857` is the regex move, the guard deletion and two comments. Identity, keys, fold, lock, crash order, hook path and M1 retry code are untouched. The D1 full read (`ledger-upkeep.ts:23`) is still pinned by the window property despite the exemption (mutation D1 below, killed 3 of 3). The six changed test files pass.

## Minor

### r1. The window property's exemption also hides an undercount (Medium)

- **Where:** `report-window.property.integration.test.ts:380-387`. Every record of a call with an older-CLI copy is dropped from both sides of `expect(inside(bounded)).toEqual(inside(full))`.
- **The documented limit** (`contract.md` Limits row, `usage-contract.md` `repository-ids.json` row): a bounded report "may count such a copy as well as the call's other copy". An over-count only. Reasoned: when the full read's winner is in the period, its day is in the window and no in-window copy can beat it, so the bounded read must return that same record. A bounded read never legitimately loses the call.
- **Failure, reproduced by hand mutation:** `usage-ledger-adapter.ts:96`, insert before it `if (record !== read && holds !== undefined) continue;`, so every bounded read drops each re-keyed older-CLI line.
  - A report with a period then silently omits those calls.
  - The window property passed in 2 of 4 runs. It went red only when a later requestful store rewrote the older line's day and so deleted it from disk (`full.length` assertion), not through the exempted comparison.
  - The other 74 telemetry test files passed with the mutant.
- **Not an older-CLI case:** none found. The exemption also covers the new-CLI copies of an exempt call, but non-exempt requestless calls still kill the D1 mutant 3 of 3.
- **Fix:** for exempt keys, assert the limit instead of skipping it. Each in-period full record of an exempt call must equal the bounded record of its key. The bounded read may hold an extra exempt record only when the full winner of that key is outside the period.

### r2. The PR description contradicts the new limit

- `## How it works`, Read-time rules: "Figures stay right in a half-migrated state, and when an older CLI writes again afterwards." Since n1 this holds only for a report with no period.
- Requestless calls: "A bounded report then agrees with the full one." Same qualifier missing. The Limits bullet in the same body says the opposite.
- "hand mutations (23, then 12 more, all killed)": round 3 added n3, P-a and M1-h.
- **Fix:** qualify both sentences ("in a report with no period; see Limits") and update the count.

### r3. Stryker 98.8 is claimed in the PR, not recorded in evidence.md, and not reproduced

- The PR claims "Stryker on the lines changed since `57169330`: 98.8, one equivalent survivor". evidence.md has no such run: its last Stryker figure is 97.2.
- Rerun (scope below, wider than the changed lines): `All files | 95.11 | 214 killed | 11 survived`. In lines changed since `57169330`, two survive, not one:
  - `claude-transcript-usage.ts:16`, `$` anchor removed: equivalent, as the PR says.
  - `ledger-upkeep.ts:23`, `incoming.some(isKeyedBySession)` to `incoming.every(...)`: **not equivalent** (r4).
- **Fix:** record the command, scope, score and survivors in evidence.md, or drop the claim. "Never state … anything not just observed" (`coding-assertions.md`).

### r4. The D1 trigger for a mixed batch is pinned only by chance (Medium)

- **Where:** `ledger-upkeep.ts:23`. With `every`, a batch holding one requestless call and one with a `requestId` takes the one-day window, so the requestless call's far copies are not read and the ledger holds it twice: the D1 defect, back for any transcript that mixes both kinds.
- **Evidence:** survived the Stryker run. By hand, window property plus `ledger-upkeep.integration.test.ts`, three runs: passed, red, red (`× leave every bounded read equal to the full ledger filtered to its period`). Only the random generator catches it; no example test builds a mixed batch.
- **Fix:** an example test in `ledger-upkeep.integration.test.ts`: a requestless copy stored days earlier, then one batch of its other copy plus a call with a `requestId`; the ledger holds the requestless call once. It must go red under `every`.
- Also surviving, PR code outside the changed-since-`57169330` lines: `repository-aliases.ts:23`, dropping `object?.version !== FORMAT` or `typeof object.complete !== "boolean"`. A table with a wrong version or a non-boolean `complete` is read as valid. Low: only this CLI writes the file. Fix: one parse test each. `repository-aliases.ts:20` (`text ?? ""` to any non-JSON string) is equivalent.

## Tests-first

- n1: red run recorded before the exemption (evidence.md).
- n3, n4: tests passed on the code as it stood, and evidence.md says so. Each is proven by a mutation instead. M1-h re-run here: killed.

## Checklist

| Item | Result |
| --- | --- |
| No duplication | holds: one `ADVISOR` |
| No incoherence | partial: PR body vs Limits (r2) |
| No over-engineering | holds. `olderOf` (`report-window…test.ts:335`) is a one-line helper, used twice, acceptable |
| No dead code or debug leftovers | holds: `git diff a06f9857..429948a3 -- cli/src` adds no logs and no TODOs |

## Bundle

`node scripts/check-bundle-size.mjs`: `Bundle size: 700.6 KB / budget: 709 KB`, `OK: within budget`. `dist/cli.js` 717,408 B, built 09:38, after the head commit (09:33). Matches the PR.

## Commands

All CLI runs sandboxed (`HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR` in the scratchpad, `GIT_CONFIG_NOSYSTEM=1`). Mutations under `mutation.lock`, each file restored, `git status` clean after.

| Command | Decisive output |
| --- | --- |
| `vitest run` on `application/legacy`, the window property, `claude-transcript-usage.unit`, `legacy-usage-key.unit`, `stored-ids-and-keys`, `ledger-upkeep` | `Test Files 6 passed`, `Tests 78 passed` |
| mutant D1, `ledger-upkeep.ts:23` full read disabled, window property x3 | red 3 of 3, counterexamples with two non-older requestless copies |
| mutant r1, `usage-ledger-adapter.ts:96` bounded read drops re-keyed lines, window property x3 then `vitest run tests/contexts/telemetry` | passed, red, passed; then `1 failed | 74 passed` (the window property only) |
| mutant M1-h, `stored-usage-migration.ts:40` `complete: table !== null` | `× stopped at any write of a pending root's retry …`, `1 failed | 14 passed` |
| `stryker run --mutate` on `ledger-upkeep.ts:1-24`, `stored-usage-migration.ts:10-70`, `claude-transcript-usage.ts:15-84`, `legacy-usage-key.ts:1-14`, `repository-aliases.ts:9-36`, `period.ts:35-42`, `ingest-usage-use-case.ts:74-98`, `usage-ledger-adapter.ts:42-66` | `95.11`, `214` killed, `11` survived; in-PR survivors listed in r3, r4. The rest (`claude-transcript-usage.ts:20-62`, `ingest-usage-use-case.ts:89`) are lines this PR does not change |
| mutant r4, `ledger-upkeep.ts:23` `some` to `every`, window property + `ledger-upkeep` x3 | passed, red, red |
| `node scripts/check-bundle-size.mjs` | `700.6 KB / budget: 709 KB` |

Not run: the full suite (pre-push passed it at `429948a3`: 6,809 tests).

## Score

90 = 100, minus 3 (r1: the exemption hides an undercount, which a mutant survives), minus 2 (r2: the PR body contradicts the limit), minus 2 (r3: a mutation score unrecorded and contradicted by a rerun), minus 3 (r4: the D1 trigger for a mixed batch has no deterministic test; two unpinned table checks).
