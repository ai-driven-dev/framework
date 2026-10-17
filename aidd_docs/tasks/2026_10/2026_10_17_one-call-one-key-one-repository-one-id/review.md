---
status: changes-requested
---

# Review: One call, one key; one repository, one id (round 4)

Head `102baf98`, base `origin/next`. Independent check, read-only on the code. Round 3 (90/100, head `429948a3`) is superseded by this report.

**Verdict: changes requested, minors only. Score 94/100.**

No deal breaker. `cli/src` is unchanged since `429948a3` (`git diff --quiet 429948a3 HEAD -- src`), so every round-4 change is a test or a doc. r2, r3 and r4 hold. r1 is half done: the new assertion catches a bounded read that *drops* an older-CLI call, but not one that keeps the call with a *smaller* snapshot. A hand mutant of that kind survives 3 of 3 runs, and a probe shows it undercounting. Three numbers in the PR description are not in evidence.md.

## Deal breakers

None.

## Round 3 findings, re-checked

| # | Claim | Status | Evidence |
| --- | --- | --- | --- |
| r4 | a fixed mixed-batch test kills `some` to `every` at `ledger-upkeep.ts:23` | fulfilled | `ledger-upkeep.integration.test.ts:232`. `every`: red 3 of 3. Own mutants: `incoming.slice(0, 1).some(...)` red 3 of 3 (the fixed test); `incoming.slice(-1).some(...)`, which the fixed test's order lets through, red 3 of 3 (the window property) |
| r4 | the table's `version` and `complete` checks are tested | fulfilled | `repository-aliases.unit.test.ts:27-38`, each case valid but for the one field |
| r1 | the window property asserts the limit instead of skipping | partial | catches a drop; misses a smaller snapshot (r1b below) |
| r1 | assertion not flaky | fulfilled | `onDisk` reads the same day files `inWindow` selects (no monthly file is generated) and keys them with the same `currentKeyOf`. Exact for counts: the window property green in 4 runs |
| r2 | PR description consistent with the limit | fulfilled | "Read-time rules" and "Requestless calls" now qualified; matches `contract.md:77, :80, :98` and the usage contract |
| r3 | changed-line Stryker runs recorded | fulfilled | evidence.md "r3": command, both scopes, mutant counts, survivors. 98.8 % of 83 is 82 killed (1 survivor), of 252 is 249 (3 survivors): consistent |

### The three equivalence claims

| Survivor | Holds? | Why |
| --- | --- | --- |
| `claude-transcript-usage.ts:16`, `$` dropped | yes, given an input invariant | the only writer appends `#advisor${n}` at the end (`:140`). Without `$` a match can differ only if a message, request or session id contains `#advisor<digits>`. Anthropic ids and Claude Code session UUIDs do not. Nothing enforces that |
| `repository-aliases.ts:20`, `text ?? ""` to any non-JSON string | yes | `tryParseJson` fails on both, so `object` is `null` and the result `null` either way |
| `legacy-repository-identity.ts:9`, `address === null` to `false` | yes | `path` is `null` at `:8` whenever `address` is, so `path === null` returns the same |

### No regression in earlier rounds

No test weakened: the test diff since `429948a3` only adds assertions and cases, and the `repository-aliases` "another format" case is replaced by a stricter one (all else valid). Source untouched since round 3, which verified identity (one id, no alias chain), keys, fold, lock, crash order, the hook path and the M1 retry. Re-run green here: the migration properties (fresh ingest on six axes and bytes, twice equals once, stop at every write), the #1032 window property, the requestless window property, stored ids and keys, the lock and stream properties, the ingest e2e.

## Minor

### r1b. The window property misses an older-CLI call kept with a smaller snapshot (Medium)

- **Where:** `report-window.property.integration.test.ts:400-405`. For exempt keys it checks `count(bounded)` and `count(full)` only, never the bounded record's content. Round 3 asked for the record itself: "each in-period full record of an exempt call must equal the bounded record of its key".
- **Why it matters:** the limit (`contract.md:98`) allows an over-count only. When the full winner of an exempt call is in the period, its day is in the window, so the bounded fold sees it and must return that same record. Anything smaller is an undercount the limit does not allow.
- **Failure, reproduced:** mutant inserted before `usage-ledger-adapter.ts:96`:

  ```ts
  if (record !== read && holds !== undefined && heldIn.has(`${record.tool}\u0000${record.key}`)) continue;
  ```

  A bounded read skips an older-CLI copy whenever another copy of the call is already held, whatever its size.
  - Window property, `ledger-upkeep`, `usage-ledger-adapter`, `stored-ids-and-keys`: `Tests 88 passed (88)`, 3 runs of 3.
  - Scratchpad probe, new copy `output 1` on 2026-10-01, older-CLI copy `output 5` on 2026-10-02, window holding both: `PROBE bounded [ 'msg_1:s-1/1' ] full [ 'msg_1:s-1/5' ]`. On the real code the probe passes.
  - Under the same mutant, a report with a period would also settle those days from the smaller record, so the better copy leaves the disk.
- **Fix:** keep the count check and add, for each exempt key whose full record is in the period, `expect(bounded.find((r) => r.key === key)).toEqual(full.find((r) => r.key === key))`. Prove it with the mutant above.

### r5. Three PR-description numbers have no record in evidence.md (Low)

- "`cd cli && pnpm test`: 6,813 passed": evidence.md's last full run is 6,789.
- "`node --test …`: 461 of 461": evidence.md has 460 of 460.
- "Bundle: 717,408 B": evidence.md has 716,597 B. Only the round-3 review held 717,408, and this report replaces it. Measured here: `dist/cli.js` 717,408 B, built 12:37, after the head commit (12:35). So the figure is right but unrecorded.
- "Gates on the final commit": smoke and the tokens end-to-end runs are recorded once, at the first build, not at `102baf98`.
- **Fix:** add the final-commit gate runs to evidence.md (`Gates` table), or say which commit each figure comes from.

### r6. The hand-mutation count is loose (Low)

- evidence.md: "45: 23 … 12 … 3 … 7 in round 3 (the five above, and the two Stryker survivors)". The "two survivors" are four mutants (`>=`, `true`, and "two mutants" at `usage-ledger-adapter.ts:96`). G-j (the merge fix) is listed as killed but in no count.
- **Fix:** count mutants, not rows, and include G-j; update the PR's "45".

## Checklist

| Item | Result |
| --- | --- |
| No duplication | holds |
| No incoherence | partial: PR numbers vs evidence.md (r5, r6) |
| No over-engineering | holds. The `onDisk` scan is 8 lines and reads only what the assertion needs |
| No dead code or debug leftovers | holds: no `cli/src` change since round 3; the test diff adds no logs or TODOs |
| Public repo | holds: the caller's local-path grep on `git diff origin/next...HEAD`, plus the username and the session-id prefix, finds nothing (exit 1). The same grep on this file finds nothing |

## Commands

All runs sandboxed (`HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR`, `TMPDIR` in the scratchpad, `GIT_CONFIG_NOSYSTEM=1`). Mutations under `mutation.lock`, each file restored with `git checkout --`, `git status` clean after.

| Command | Decisive output |
| --- | --- |
| `vitest run` window property, `ledger-upkeep`, `usage-ledger-adapter`, `stored-ids-and-keys`, `domain/legacy`, `application/legacy`, `claude-transcript-usage.unit`, `repository-identity.unit` | `Test Files 13 passed`, `Tests 227 passed` |
| `vitest run` ingest unit, bindings lock, `application/report`, ingest e2e, transcript-stream-ingest property | `Test Files 11 passed`, `Tests 169 passed` |
| `vitest run` ledger lock, transcript-stream property, `application/legacy` | `Test Files 3 passed`, `Tests 29 passed` |
| window property + `application/legacy`, 2 more runs | `Tests 6 passed`, twice |
| `ledger-upkeep.ts:23` to `incoming.every(...)`, `ledger-upkeep` x3 | `× reads every day for a batch mixing …`, 3 of 3 |
| `ledger-upkeep.ts:23` to `incoming.slice(0, 1).some(...)`, `ledger-upkeep` + window property x3 | fixed test red 3 of 3 |
| `ledger-upkeep.ts:23` to `incoming.slice(-1).some(...)`, same x3 | `× leave every bounded read equal …`, 3 of 3 |
| `usage-ledger-adapter.ts:96`, `if (record !== read && holds !== undefined) continue;` (round 3's), window property x3 | red 3 of 3 |
| `usage-ledger-adapter.ts:96`, drop a re-keyed copy only when none is held yet, window property x3 | red 3 of 3 |
| `usage-ledger-adapter.ts:96`, drop a re-keyed copy only when one is held (r1b), four files x3 | `Tests 88 passed (88)`, 3 of 3: **survives** |
| scratchpad probe under that mutant, then on the real code | `bounded [ 'msg_1:s-1/1' ] full [ 'msg_1:s-1/5' ]`; then `Tests 1 passed` |
| `stat dist/cli.js` | `717408`, built after `102baf98` |

Not run: the full suite (pre-push passed it at `102baf98`: 6,813 tests, per the caller), Stryker (r3's record checked for consistency, not reproduced).

## Score

94 = 100, minus 3 (r1b: the limit's "never an undercount" is pinned for a drop only; a smaller-snapshot mutant survives), minus 2 (r5: three PR figures and the final-commit gates unrecorded), minus 1 (r6: mutation count loose).
