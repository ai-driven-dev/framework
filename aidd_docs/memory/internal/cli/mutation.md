# CLI Mutation

Scopes, floors and when each runs: the `$comment` of `cli/mutation-scopes.json`.

- Run `pnpm test:mutation:<scope>`, or `node scripts/run-mutation.mjs --changed [<base>]` before a push.
- Raise a floor to the measured score; lower it only with a reason in the scopes file.
