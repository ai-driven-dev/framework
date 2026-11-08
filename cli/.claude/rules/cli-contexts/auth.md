---
description: Apply when a token is read, stored or checked; the auth context owns the one GitHub token, and nothing else reads it.
paths:
  - "src/contexts/auth/**/*.ts"
  - "src/composition/auth.ts"
  - "tests/contexts/auth/**/*.ts"
  - "src/contexts/*/application/**/*.ts"
---

# Auth

## Reason to change

- One GitHub credential: kept, found, checked, removed. Auth never makes a business call with it.
- Its language is `src/contexts/auth/glossary.md`; a name in the code means what that page says.
- Its shape is the strict reference: `reference-context.md`, beside this page.

## Ports

- `CredentialRecordRepository`: the record of each level, read, saved and deleted by level.
- `ExternalTokenSource`, `CliAuthProvider`: a provider's token and its identity check (`gh`).
- `IdentityVerifier`: who a stored token belongs to.
- Published in `contract/`: `TokenProvider` (distribution, framework, self-update) and the credential types (presentation).

## Suppliers

- `shared/ports/environment.ts`: a token handed to the run in a variable.
- `shared/infrastructure/github-adapter.ts`: the `/user` check, an `IdentityVerifier` by shape, handed in by `src/composition/auth.ts`.
- `kernel/`: errors, `Logger`, `AIDD_DIR` (migration state M3 of the reference).

## Never

- Read a token variable or `auth.json` outside the context.
- Refuse a command for a missing token: authorization surfaces as `CatalogFetchAuthError` on a 401.
- Restate the source order elsewhere: it is `sourcesInOrder`, described once in `aidd_docs/memory/internal/auth.md`.
