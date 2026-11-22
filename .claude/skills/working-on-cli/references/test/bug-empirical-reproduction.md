# Reference: Bug Empirical Reproduction

## The rule

When fixing a user-reported bug, the reviewer MUST empirically reproduce the user's exact reported scenario end-to-end using the production CLI binary. Unit and E2E tests with simplified fixtures are necessary but not sufficient.

A `ship` verdict is forbidden without an empirical reproduction transcript.

## Transcript format

```text
## Empirical reproduction

### Pre-fix (main / broken baseline)
$ <exact commands>
<output showing the user's error verbatim>

### Post-fix (this branch)
$ <same exact commands>
<output showing expected success>
```

Include:
- The exact command sequence from the bug report
- The environment that matters: source kind, tool target, plugin selection, cache state
- Expected vs observed output including stderr and exit codes

## Why automated tests aren't sufficient

A previous fix shipped with every test green, two E2E scenarios passing and a passing review score, yet the user-reported bug was not fixed: the E2E used `--source local`, which bypassed the broken code path. A manual `aidd marketplace add` then `aidd framework install --tool cursor` would have caught it.

## Coverage ranking

| Tier | Sufficient alone? |
| ---- | ----------------- |
| Unit | no |
| Integration | no |
| E2E (simplified fixture) | no |
| Empirical reproduction (real binary, real scenario) | yes |

## Network-gated scenarios

Run once locally; capture the transcript in the PR body. Do not automate as CI.

## High-confidence skip

The empirical step may only be skipped when ALL of: purely cosmetic fix, no control flow change, no new code path, stated explicitly by reviewer: "Skip empirical: purely cosmetic, no behavior change."
