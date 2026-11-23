# CLI Mutation

Stryker, per CLI scope, gated in `cli-ci.yml` on the scopes a change touches.

- Scopes and floors: `cli/mutation-scopes.json`; selection: `cli/scripts/mutation-scopes-to-run.mjs`.
- Only `telemetry` and `shared` have floors; each runs on a pull request touching its source or tests.
- Other scopes run weekly or on demand, and never fail.
- A change to `cli/stryker.conf.json`, `cli/vitest.mutation.config.ts` or the scopes file runs every scope.
- Run `pnpm test:mutation:<scope>`, or `node scripts/run-mutation.mjs --changed [<base>]` before a push.
- Raise a floor to the measured score; lower it only with a reason in the scopes file.
