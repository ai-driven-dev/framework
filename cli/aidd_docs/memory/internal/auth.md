# Auth

How identity and access work. No user accounts: one GitHub token gates private marketplaces and plugin sources. The context's language is `src/contexts/auth/glossary.md`; its shape is the `reference-context.md` rule.

## Authentication

- Commands: `aidd auth login | logout | status` (`src/presentation/commands/auth.ts`), each a command of `src/contexts/auth/application/`, built by `src/composition/auth.ts`.
- Method per record: `stored` (a token in `auth.json`) or `external` (asked of a provider at read time). There is no `gh` method.
- Source order, the one place it is described (`sourcesInOrder`, `src/contexts/auth/domain/credential-sources.ts`): a `--token` on the command line, then `AIDD_TOKEN`, then the project record, then the user record. A place holding nothing is no source; a record is read only when the sources before it were passed over.
- Two stop rules over that one order. Token resolution (`firstToken`) passes over a record that yields no token. Status (`activeCredential`) stops at the first record held, token or not, so a tokenless project record hides the user's; status never consults the command line.
- An `external` record is asked of `gh` at its own level, whatever provider it names: a limit, since only `gh` is ever written or wired.
- Storage (`src/contexts/auth/infrastructure/credential-record-file-adapter.ts`): project `<root>/.aidd/auth.json`, user under the config dir, which `AIDD_USER_CONFIG_DIR` moves; that is how the suites stay out of a real profile.
- Shape: `{ version: 1, method, level, createdAt, token? | provider? }`, in that key order, pretty-printed. A value that breaks an invariant reads as no record (`parseCredentialRecord`), so a hand-written file authenticates nobody.
- A new file is created `0600`, so it is never readable under the umask; every write then restricts it again, `chmod 0600` on POSIX (which also closes an existing file written before) and `icacls /inheritance:r` on win32. Failing to restrict throws rather than leaving a world-readable credential. The write is not atomic: no temp file and rename.

## Authorization

- No roles, no scopes. A token is not checked up front: nothing refuses a command for lacking one.
- It surfaces at fetch time as `CatalogFetchAuthError` when the request 401s.

## Sessions

- No sessions, no refresh. A `stored` token lives until `auth logout`, which removes the first record in level order and reports the level that record names.
- `CachedTokenProvider.resolve()` memoizes per process, a failure included, and the graph is built once per project root, so `gh` is spawned at most once per invocation.
- The `gh` spawn fails two ways: absent from `PATH` answers null and degrades silently; a non-zero exit or a 3s timeout throws and aborts the command.
- With `AIDD_TOKEN` set, `auth status` verifies it as a stored user credential, with nothing on disk.
