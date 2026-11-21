# Auth

- No user accounts: one GitHub token gates private marketplaces and plugin sources.
- Language: `src/contexts/auth/glossary.md`.
- Shape: the `reference-context.md` rule.

## Credentials

- `aidd auth login | logout | status` live in `src/presentation/controllers/auth.controller.ts` and are built by `src/composition/auth.ts`.
- A record's method is `stored` (a token in `auth.json`) or `external` (asked of a provider at read time), and no method is `gh`.
- The one source order, `sourcesInOrder` in `src/contexts/auth/domain/credential-sources.ts`, is `--token`, then `AIDD_TOKEN`, then the project record, then the user record.
- Token resolution (`firstToken`) passes over a record that yields no token.
- Status (`activeCredential`) stops at the first record held, so a tokenless project record hides the user's, and it never consults the command line.
- An `external` record is asked of `gh` whatever provider it names, a limit since only `gh` is ever written.
- The project record is `<root>/.aidd/auth.json` and the user record sits under the config dir that `AIDD_USER_CONFIG_DIR` moves, which keeps suites out of a real profile.
- A value that breaks the record's invariants reads as no record (`parseCredentialRecord`), so a hand-written file authenticates nobody.
- A file is created `0600` and every write restricts it again, with `chmod` on POSIX and `icacls /inheritance:r` on win32, and a failure throws.
- The write is not atomic, with no temp file and rename.

## Authorization and sessions

- No roles, no scopes, and no command is refused for lacking a token.
- A 401 surfaces at fetch time as `CatalogFetchAuthError`.
- No sessions and no refresh: a `stored` token lives until `auth logout`, which removes the first record in level order.
- `CachedTokenProvider.resolve()` memoizes per process, a failure included, so `gh` is spawned at most once per invocation.
- An absent `gh` and a 3 second timeout both answer null silently.
- A non-zero exit throws and aborts the command.
- With `AIDD_TOKEN` set, `auth status` verifies it as a stored user credential with nothing on disk.
