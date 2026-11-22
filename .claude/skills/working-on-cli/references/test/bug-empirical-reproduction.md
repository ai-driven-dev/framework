# Bug empirical reproduction

A reviewer of a user-reported bug reproduces the exact reported scenario with the production binary. Unit and e2e tests on simplified fixtures are necessary, never sufficient. No `ship` verdict without the transcript.

## Transcript

```text
## Empirical reproduction

### Pre-fix (main / broken baseline)
$ <exact commands>
<output showing the user's error verbatim>

### Post-fix (this branch)
$ <same exact commands>
<output showing expected success>
```

- The exact command sequence from the bug report.
- The environment that matters: source kind, tool target, plugin selection, cache state.
- Expected against observed output, stderr and exit codes included.

## Sufficiency

| Tier | Sufficient alone |
| --- | --- |
| unit | no |
| integration | no |
| e2e on a simplified fixture | no |
| real binary, real scenario | yes |

## Limits

- A network-gated scenario runs once locally; its transcript goes in the PR body, never in CI.
- Skip only when the fix is purely cosmetic, changes no control flow and adds no path, and the reviewer states: "Skip empirical: purely cosmetic, no behavior change."
- A simplified fixture can bypass the broken path (for example `--source local`): reproduce with the reporter's source kind.
