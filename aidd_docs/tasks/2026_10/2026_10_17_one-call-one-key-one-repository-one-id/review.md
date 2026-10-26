---
status: approved
---

# Review: One call, one key; one repository, one id (round 5)

Head `2632e265`, base `origin/next`. Independent check, read-only on the code. Round 4 (94/100, head `102baf98`) is superseded by this report.

**Verdict: approve. Score 99/100.**

No deal breaker. r1b and r5 hold; r6 holds but for its wording (n1). `cli/src` changed only by the `ADVISOR` comment since `429948a3`. Four non-blocking nits remain, all in docs.

## Deal breakers

None.

## Round 4 findings, re-checked

| # | Claim | Status | Evidence |
| --- | --- | --- | --- |
| r1b | the window property deep-compares the bounded record to the full record of an older-CLI call | fulfilled | `report-window.property.integration.test.ts:405-410`. Round-4 mutant before `usage-ledger-adapter.ts:96`: red 3 of 3, failing at `:409:68` (the new `toEqual`). Own mutant, `found.push(record)` at `:97` to `found.push(record !== read && holds !== undefined ? { ...record, output: Math.max(0, record.output - 1) } : record)` (a bounded read shrinks an older-CLI copy, count unchanged): red 3 of 3, failing at `:409:68` |
| r1b | assertion not flaky | fulfilled | real code, unseeded fast-check (no `seed` or `configureGlobal`), 150 runs per test: green 4 of 4 |
| r5 | every PR number is in evidence.md and matches | fulfilled | see the table below |
| r6 | hand mutations counted as mutants | partial | evidence.md "Hand mutations, all rounds": 23 + 1 + 12 + 3 + 7 + 1 = 47, G-j included. But "each row is one mutant" is false for the r3 survivor table (n1). All its mutants are killed, so wording only |
| - | comment on `ADVISOR`'s `$` | fulfilled | `claude-transcript-usage.ts:15-16`, the only `cli/src` change since `429948a3` |

### PR description against evidence.md

| PR figure | evidence.md |
| --- | --- |
| 6,813 passed, 1 skipped | `:333` `Tests 6813 passed \| 1 skipped (6814)` |
| 461 of 461 | `:334` |
| smoke PASS 132, FAIL 0 | `:336` |
| tokens end-to-end, plain and `--attended` | `:337-338` |
| 97.2, floor 96 | `:100-103`, `:339` |
| 98.8 (83 mutants), 98.8 (252 mutants), three equivalent survivors | `:281-282`, survivors table, `:340` |
| 512,820 lines, 184,502 ids, 0.2687 h | D1 section |
| 1,672 ms against 13 ms | `:223`, number only (n2) |
| 4.5 s / 50 roots / 250,000; 20.8 s / 200 / 1,000,000; 110 s | `:203-212` |
| 717,408 B of 726,016 B | `:335`; measured here `dist/cli.js` 717,408 B, built 14:24:56, the head commit is 14:24:55 |
| five days; 3 and 9 days | `:174` |
| 47 mutants | `:318-327` |

### No regression

- `git diff --stat 429948a3 HEAD -- cli`: `cli/src` only `claude-transcript-usage.ts | 3 ++-` (comment). Tests since then only add assertions and cases.
- `git diff --stat 102baf98 HEAD`: evidence.md, review.md, the comment, and 6 added test lines. No test weakened.
- Regression set re-run green on the real code (below).

## Non-blocking nits

### n1. "Each row is one mutant" vs the round-3 survivor table (Nit)

- **Where:** evidence.md `:318` and `:326`; the r3 survivor table above them.
- **Issue:** that table has two rows holding two mutants each (`>=` and `true`; "two mutants" at `usage-ledger-adapter.ts:96`). The round-3 count names `>=` and "the unsettled mark" once each, so "each row is one mutant" is false for that table, and 47 counts 2 of its 4.
- **Fix:** say the count is mutants applied by hand, and that `true` and the second `:96` mutant were killed by the Stryker rerun only. Or count all four (49).

### n2. The 1,672 ms measurement has no record in the tree (Nit, beyond criterion 2)

- **Where:** PR "the checker measured 1,672 ms at 250,000 records, against 13 ms"; evidence.md `:223` cites the number only.
- **Issue:** the number is in evidence.md and matches, so r5 holds. Its command and output lived in the round-2 review, which every round overwrites. It survives in git history only.
- **Fix:** copy the command and both timings into evidence.md, next to m3.

### n3. "Gates on the final commit" (Nit)

- **Where:** PR "How to verify"; evidence.md `:329` says `8dee6830`.
- **Issue:** the gates ran at `8dee6830`, not `2632e265`. `2632e265` changes only evidence.md and review.md (checked), so the figures carry over, but the heading should say so.
- **Fix:** "Gates on the last code commit (`8dee6830`)".

### n4. The `ADVISOR` comment states an unenforced invariant as fact (Nit)

- **Where:** `claude-transcript-usage.ts:15-16`, "message and session ids hold no `#`".
- **Issue:** nothing validates it; it holds for Anthropic message ids and Claude Code session UUIDs today.
- **Fix:** "hold no `#` in the formats seen so far", or leave as is.

## Checklist

| Item | Result |
| --- | --- |
| No duplication | holds |
| No incoherence | holds, but n1 and n3 (wording) |
| No over-engineering | holds: the r1b fix is 6 test lines |
| No dead code or debug leftovers | holds: one comment in `cli/src`, no logs or TODOs in the test diff |
| Public repo | holds: the caller's local-path grep on `git diff origin/next...HEAD` exits 1; same for the username, the session-id prefix and the scratchpad id, exit 1 |

## Commands

All runs sandboxed (`HOME`, `XDG_CONFIG_HOME`, `AIDD_USER_CONFIG_DIR`, `AIDD_TELEMETRY_DIR`, `CLAUDE_CONFIG_DIR`, `TMPDIR` in the scratchpad, `GIT_CONFIG_NOSYSTEM=1`). Mutations under `mutation.lock`, the file restored with `git checkout --`, lock removed, `git status --short` empty after.

| Command | Decisive output |
| --- | --- |
| window property, real code, x4 | `Tests 2 passed (2)`, 4 of 4 |
| round-4 mutant before `usage-ledger-adapter.ts:96`; window property, `ledger-upkeep`, `usage-ledger-adapter`, `stored-ids-and-keys`, x3 | `Tests 1 failed \| 87 passed (88)`, `× leave every bounded read equal …`, 3 of 3; stack `:409:68` |
| own shrink mutant at `usage-ledger-adapter.ts:97`, same four files, x3 | `Tests 1 failed \| 87 passed (88)`, 3 of 3; stack `:409:68` |
| `application/legacy`, `domain/legacy`, `ledger-upkeep` (fixed and property), `stored-ids-and-keys`, `usage-ledger-adapter`, `claude-transcript-usage.unit`, `repository-identity` | `Test Files 13 passed (13)`, `Tests 226 passed (226)` |
| `git diff --stat 429948a3 HEAD -- cli` | `cli/src`: `claude-transcript-usage.ts \| 3 ++-` only |
| `stat -f '%z %Sm' cli/dist/cli.js` | `717408 Oct 17 14:24:56 2026` |

Not run: the full suite (pre-push passed it at `2632e265`: 6,813 tests, per the caller), Stryker, smoke, the tokens end-to-end runs (their records checked for consistency, not reproduced). Nor the ingest, bindings lock, `application/report`, ingest e2e and stream and lock properties round 4 ran: `cli/src` changed only by a comment since then.

## Score

99 = 100, minus 1 (n1: r6 partial, the mutant count wording contradicts the table it counts). n2 asks for more than criterion 2; n3 and n4 are wording. No deduction for them.
