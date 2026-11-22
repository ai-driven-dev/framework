# auth

One GitHub credential: kept, found, checked, removed, never used for a business call. Language: `src/contexts/auth/glossary.md`. Where a 401 surfaces and the source order (`sourcesInOrder`): `aidd_docs/memory/internal/auth.md`.

## Ports

- `CredentialRecordRepository`: the record of each level. `ExternalTokenSource`, `CliAuthProvider`: a provider's token and identity check (`gh`). `IdentityVerifier`: who a stored token belongs to.
- `contract/`: `TokenProvider`, read by distribution, update and `src/orchestration/doctor/check-authentication.use-case.ts`; the credential types, read by presentation.

## Suppliers

- `shared/ports/environment.ts` (a token given in a variable), `shared/ports/http-get.ts` (the identity request), `shared/`: errors, `Logger`, `AIDD_DIR`.

## Never

- Read the token variable or `auth.json` outside the context (`token-owner.grit`).
- Refuse a command for a missing token.
- Restate the source order outside `aidd_docs/memory/internal/auth.md`.

## Exceptions

- `CachedTokenProvider` is not a command but sits in `application/`: the published `TokenProvider` needs memo and logs, which the domain may not hold.
- A `contract/` file counts presentation as an outside importer (it reads the credential types).
- auth keeps its own permission code (`credential-record-file-adapter.ts`): the shared `PrivateStorage` has no delete and grants a directory where auth grants the file.
- The `gh` contract's real arm runs on POSIX only (`describe.skipIf`): `spawnSync` resolves no `.cmd` and the repository fakes binaries with `#!/bin/sh`.
