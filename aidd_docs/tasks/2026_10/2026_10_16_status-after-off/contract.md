---
status: done
issue: 1035
---

# Status after `off` says measurement was turned off

## Need

After `aidd telemetry on` then `aidd telemetry off`, `aidd telemetry status` prints `Not measured: this clone has not run \`aidd telemetry on\`.` (#1035). That is false: the clone ran `on`. The person is told to do what they already did, and is not told that they turned measurement off themselves. `aidd telemetry task` in that clone says the same falsehood: `This clone has not opted in to measurement`.

`off` leaves a trace that tells the two apart: it writes `aidd.telemetry = off` (`CONSENT_WITHDRAWN`) in the clone's git config, and only when the clone's key granted consent. A clone that never ran `on` has no key, or a key that grants nothing and is not `off`.

## Decision

| # | Decision | Why |
| --- | --- | --- |
| 1 | A new refusal reason, `turned-off`, beside `no-consent`, read from the key `off` | The refusal reason is printed as text only: `status` and `task` have no JSON output, and the report's refused envelope carries no reason. No contract changes, and the exhaustive word tables force both commands to say something true |
| 2 | The domain says what the key `off` means, in a function of its own beside `CONSENT_WITHDRAWN`; `consentOf` keeps its three answers | `consentOf` is pinned by the fixture the hooks share (`scripts/__tests__/fixtures/telemetry-bindings`, `off` reads `absent`), and the hooks only ask whether a key grants. The application compares no strings |
| 3 | `NotStoredReason` and the report envelope are not touched | `not_stored.no-consent` is part of `version: 1`, and the issue is about status |

## Surface

| Command | After `on` then `off` | Clone that never ran `on` |
| --- | --- | --- |
| `aidd telemetry status` | `Not measured: measurement was turned off in this clone. Run \`aidd telemetry on\` to measure it again.` exit 0 | unchanged: `Not measured: this clone has not run \`aidd telemetry on\`.` |
| `aidd telemetry task <name>` | `Measurement was turned off in this clone, so no task was declared. Run \`aidd telemetry on\` here to measure it again.` exit 1 | unchanged |

## Rules

| # | Rule |
| --- | --- |
| 1 | A key of exactly `off` is `turned-off`, whether `off` wrote it or a person did by hand: either way measurement was turned off in this clone, and `on` turns it back on |
| 2 | Any other key that grants nothing (absent, `2`, `true`, `{}`) stays `no-consent` |
| 3 | Precedence is unchanged: `AIDD_TELEMETRY=0`, outside a repository, unidentified repository and an unreadable git config come first. `turned-off` is decided only once the consent log is read and the clone identified, where `on` would not refuse it: a key `off` with a damaged log, or a clone with no identity, reads `unreadable-consent`, so status never advises an `on` that would fail. An absent key still reads `no-consent` before the log, as today |
| 4 | `on` after `off` measures again and status says so, as today |

## Unchanged

The consent key format, the consent log, `off` itself, ingest and its `not_stored` reasons (`no-consent` still counts calls made while a clone was off), the report envelope, the hooks. A key `2:<token>` that names a closed interval, the status-side counterpart of `consent-closed`, still reads `no-consent`: the `on` then `off` flow never leaves one.

## Docs

The usage contract states what `status` says after `off`. No doc, skill or hook quotes the old message (grep in `evidence.md`).

## Acceptance

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | Each Surface row and Rules 1 to 3 have a test, written first and seen failing | tests, red run in `evidence.md` |
| 2 | A never-on clone keeps today's status and task text, byte for byte | existing display tests unchanged |
| 3 | Each guard is proven by a mutation that turns it red | `evidence.md` |
| 4 | `cd cli && pnpm test`, lefthook pre-commit and pre-push green | `evidence.md` |
| 5 | `pnpm smoke` passes and the bundle stays within 695 KB | `evidence.md` |
| 6 | `scripts/check-claude-tokens-end-to-end.cjs` passes, plain and `--attended` | `evidence.md` |
| 7 | Telemetry mutation at 96 or above, every mutant on a changed line killed or explained | stryker |
| 8 | Sandboxed repro: after `off`, status is wrong before and right after; a never-on and an on clone unchanged | `evidence.md` |
