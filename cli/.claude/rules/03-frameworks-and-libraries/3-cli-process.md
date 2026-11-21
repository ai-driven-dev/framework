---
description: Apply to the process, its channels and its exit codes; the CLI exits when the action resolves.
paths:
  - "src/cli.ts"
  - "src/presentation/**/*.ts"
---

# The CLI Process

- Never fire and forget: `unref()` and floating promises die with the process.
- Deferred work rides an online command (`ONLINE_COMMAND_PATHS` in `presentation/hooks/update-notice-hooks.ts`), awaits behind a timeout, or runs detached.
- The hot path is offline: read cache, print, return.
- Assert a side effect against the built binary (e2e or `pnpm smoke`).
- `stdout` carries info, success and results.
- `stderr` carries debug, warnings and errors.
- A conflict or skip is `warn`, never `error`.
- End with a one-line summary.
- `CLIOutput` routes by level, nothing else.
- Rendering lives in `presentation/display/`.
- Deciding lives in the use case.
- Exit `0` when it did what was asked.
- Exit `1` on a thrown error, an invalid `--scope`, an invalid `translate` flag, an unhealthy `doctor`, a guard needing a TTY, no argument without a TTY (commander prints help to stderr), or a result that reports a failure: a refused telemetry step, a failed marketplace refresh, recipe findings.
- A thrown error becomes a code through `failCommand`; a command whose result reports a failure sets exit `1` itself.
- A command may exit before the use case runs on a refusal: a missing flag or a non-interactive guard.
- `process.exit` stays out of `shared/`, `contexts/` and `presentation/`; presentation ends a run with `output.exit`, which the composition root wires to the process: `biome-plugins/no-process-exit.grit`.
