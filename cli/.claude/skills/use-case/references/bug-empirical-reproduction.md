# Reference: Bug Empirical Reproduction

## The rule

When fixing a user-reported bug, always write a failing test FIRST that reproduces the exact reported scenario. Unit tests, integration tests, and E2E tests with simplified fixtures are necessary but not sufficient on their own.

The PR description must include an empirical reproduction transcript:

```text
## Empirical reproduction

### Pre-fix (main / broken baseline)
$ <commands>
<output showing the user's error verbatim>

### Post-fix (this branch)
$ <same commands>
<output showing expected success>
```

## Coverage tier ranking

| Tier | Sufficient alone? |
| ---- | ----------------- |
| Unit | no |
| Integration | no |
| E2E with simplified fixture | no |
| Empirical reproduction (real binary, real scenario) | yes |

## How to skip (rare)

The empirical reproduction may be skipped only when ALL of these hold:
- Fix is purely cosmetic (typo, doc, comment)
- No control flow change
- No new code path
- Stated explicitly in the review: "Skip empirical: purely cosmetic, no behavior change."
