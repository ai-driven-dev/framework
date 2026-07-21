# 04 - Empirical Repro

Produce an empirical reproduction transcript for a user-reported bug using the real production CLI binary.

## Inputs

- `bug-report` (required) - string, the user's exact reported scenario and commands
- `branch` (required) - string, the fix branch name

## Outputs

```text
## Empirical reproduction

### Pre-fix (main / broken baseline)
$ aidd ai install cursor
Error: VersionMismatchError — expected 4.1.0, got 4.0.2

### Post-fix (this branch)
$ aidd ai install cursor
Installed cursor (12 files)
```

## Depends on

- `03-write`

## Process

1. Read `references/bug-empirical-reproduction.md` in full before proceeding.
2. Build the CLI on the broken baseline (`main` or the broken commit): `pnpm build`.
3. Run the user's exact commands from the bug report against the baseline binary. Capture the output verbatim including stderr and exit code.
4. Check out the fix branch. Build: `pnpm build`.
5. Run the same commands against the fix branch. Capture output.
6. Format both captures as the transcript block shown in Outputs above.
7. Include in the PR description under "## Empirical reproduction".
8. If the scenario requires real network access, run once locally and include the transcript verbatim in the PR body. Do NOT automate as a CI test.

## Test

The transcript is the test. Pre-fix output shows the reported error; post-fix output shows expected success.
