# Auth glossary

The language of the `auth` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Credential | What a person hands `auth login`: a token to keep, or the name of a provider to ask for one | `Credential`, `contract/credential.ts` |
| Method | How a credential yields its token: `stored` keeps it, `external` asks a provider at read time | `AuthMethod` |
| Level | Where a record is kept: `project` (`<root>/.aidd/auth.json`) or `user` (the user configuration directory). The project's record comes first | `AuthLevel`, `LEVELS_BY_PRECEDENCE` |
| Record | The document one level keeps: a credential, its level and when it was recorded. A value that breaks an invariant is no record | `CredentialRecord`, `parseCredentialRecord` |
| Provider | A command-line tool that holds a session of its own and answers a token or a login; `gh` is the only one wired | `CliAuthProvider`, `providerOf` |
| Command-line token | A token passed with `--token` for one run, never kept | `SuppliedTokens.commandLine` |
| `AIDD_TOKEN` | The variable that hands a token for a run without storing it | `TOKEN_VARIABLE` |
| Source | One place a token can come from, in the one order there is (`sourcesInOrder`) | `CredentialSource`, `sourcesInOrder` |
| Active credential | What `auth status` verifies: the first source that holds a credential, whether or not it would yield a token | `ActiveCredential`, `activeCredential` |
| Removal hint | What a person still has to do after logging out of an external provider: end its own session | `RemovalHint`, `removalHint` |
| Identity check | Asking who a token belongs to before it is kept or reported. A stored token is checked against GitHub's `/user`, an external one by its provider | `IdentityVerifier`, `CliAuthProvider.verify` |
