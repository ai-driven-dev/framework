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
- `stdout` carries info, success and results; `stderr` carries debug, warnings and errors.
- A conflict or skip is `warn`, never `error`; end with a one-line summary.
- `CLIOutput` routes by level, nothing else; rendering lives in `presentation/display/`, deciding in the command.
- Exit `0` when it did what was asked; exit `1` on a thrown error, an unhealthy `doctor` or a guard needing a TTY.
- `errorHandler.handle` alone turns a domain failure into a code.
- A command may exit before the command runs on a refusal: missing flag, non-interactive guard.
- `process.exit` stays out of `shared/`, `contexts/` and two presentation files: `biome-plugins/no-process-exit.grit`.
