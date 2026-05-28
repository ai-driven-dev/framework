# Bug Empirical Reproduction — MANDATORY

## The rule

When fixing a user-reported issue, the reviewer **MUST** empirically reproduce the user's **exact reported scenario** end-to-end using the production CLI binary. Unit tests, integration tests, and E2E tests with simplified local fixtures are **not sufficient**.

Reviewer verdict `ship` is **forbidden** without an empirical reproduction transcript demonstrating:

1. **Pre-fix state** — the user's reported error reproduces on `main` (or the broken baseline).
2. **Post-fix state** — same exact commands run against the fix branch produce the expected success.

The transcript must include :

- The exact command sequence from the user's bug report (or a faithful adaptation, documented when adapted).
- The environment that matters: source kind (GitHub remote vs file local vs npm), tool target, plugin selection, fresh `.aidd/` cache state.
- The expected vs observed output, including stderr warns and exit codes.

## Why this rule exists

A previous fix (#271, v4.5.1 patch) shipped reviewer-approved with:
- 1813 tests passing
- Two e2e scenarios green
- Reviewer score 82/100, verdict `ship`

But the user-reported Bug B (`aidd ai install <tool>` propagation version warns) **was not actually fixed**. The fix patched only one of two `VersionMismatchError` throw sites; the second site fired in real propagation flow against a real GitHub source. The unit tests stubbed the second-throw flow. The E2E used `--source local` which bypassed the broken code path entirely.

A manual `aidd marketplace add ai-driven-dev/aidd-framework + aidd ai install cursor` would have caught it in 30 seconds. Without that step, a "ship" verdict was published on a still-broken fix.

## How to apply

### For the implementer

Include an empirical reproduction transcript in the PR description, formatted :

```text
## Empirical reproduction

### Pre-fix (main / broken baseline)
$ <commands>
<output showing the user's error verbatim>

### Post-fix (this branch)
$ <same commands>
<output showing expected success>
```

### For the reviewer

Before assigning `ship`:

1. Read the PR's empirical reproduction transcript.
2. Re-run the same command sequence locally against the fix branch.
3. Compare your local output to the transcript and to the user's reported error.
4. If you can't reproduce the user's exact scenario (e.g. network-gated, requires a paid account), state explicitly in the review: `Cannot reproduce — relying on PR transcript`.
5. If the transcript is missing or shallow, downgrade to `iterate` with a fix list: "Add empirical reproduction transcript for the user's exact scenario".

### For high-confidence skips

The reviewer **may** skip the empirical reproduction step only when **all** of the following hold:

- The fix is purely cosmetic (typo, doc, comment).
- No control flow change.
- No new code path.
- Confirmed in writing by the reviewer: `Skip empirical: purely cosmetic, no behavior change.`

Otherwise the rule applies.

## Coverage tiers — explicit ranking

| Tier | Mock dependencies? | Real binary? | User scenario? | Sufficient on its own? |
|---|---|---|---|---|
| Unit | yes | no | no | no |
| Integration | partial | no | no | no |
| E2E with simplified fixture | no | yes | no | no |
| **Empirical reproduction** | **no** | **yes** | **yes** | **yes** (required for ship verdict on user-reported bugs) |

A green unit test is necessary but never sufficient. A green E2E with a simplified fixture is necessary but never sufficient. **Only the empirical reproduction tier closes the loop on a user-reported bug.**

## Network-gated scenarios

When the user's scenario requires network (real GitHub source, real npm registry, real auth), the reproduction is still required. Run it once locally; capture the transcript verbatim in the PR body. Do **not** automate it as a CI test (the test pyramid explicitly forbids real-network E2E).

The PR body transcript IS the closing evidence for the bug-empirical-reproduction rule.
