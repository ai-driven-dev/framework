# Auth

One GitHub token gates private marketplaces and plugin sources; no user accounts. Language: `cli/src/contexts/auth/glossary.md`.

## Credentials

| Fact | Where |
| --- | --- |
| `aidd auth login, logout, status` | `cli/src/presentation/controllers/auth.controller.ts`, built by `cli/src/composition/contexts/auth.ts` |
| Source order: `--token`, `AIDD_TOKEN`, project record, user record | `sourcesInOrder` in `cli/src/contexts/auth/domain/credential-sources.ts` |
| Project record | `<root>/.aidd/auth.json` |
| User record | under the config dir; `AIDD_USER_CONFIG_DIR` moves it, keeping suites off a real profile |

- A record's method is `stored` (a token in `auth.json`) or `external` (asked of a provider at read time).
- An `external` record always asks `gh`, whatever provider it names: only `gh` is ever written.
- Resolution (`firstToken`) skips a record that yields no token.
- Status (`activeCredential`) stops at the first record held: a tokenless project record hides the user's.
- Status never reads the command line; with `AIDD_TOKEN` set, it verifies that token with nothing on disk.
- A record breaking its invariants reads as none (`parseCredentialRecord`): a hand-written file authenticates nobody.
- Files are `0600`, restricted again on every write: `chmod` on POSIX, `icacls /inheritance:r` on win32; a failure throws.
- The write is not atomic: no temp file and rename.

## Authorization and sessions

- No roles or scopes; no command is refused for lacking a token.
- A 401 surfaces at fetch time as `CatalogFetchAuthError`.
- No refresh: a `stored` token lives until `auth logout`, which removes the first record in level order.
- `CachedTokenProvider.resolve()` memoizes per process, failure included: `gh` spawns at most once per command.
- An absent `gh` or its 3 second timeout answers null silently; a non-zero exit aborts the command.
