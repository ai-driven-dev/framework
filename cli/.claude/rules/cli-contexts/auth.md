---
description: Apply when a token is read, stored or checked; the auth context owns the one GitHub token, and nothing else reads it.
paths:
  - "src/contexts/auth/**/*.ts"
  - "src/composition/auth.ts"
  - "tests/contexts/auth/**/*.ts"
---

# Auth

## Reason to change

- One GitHub credential: kept, found, checked, removed, never used for a business call.
- Its language is `src/contexts/auth/glossary.md`.
- Its shape follows `reference-context.md`, beside this page.

## Ports

- `CredentialRecordRepository`: the record of each level, read, saved and deleted by level.
- `ExternalTokenSource`, `CliAuthProvider`: a provider's token and its identity check (`gh`).
- `IdentityVerifier`: who a stored token belongs to.
- `contract/`: `TokenProvider`, read by distribution and update through the `ALLOWED` edges.
- `contract/`: the credential types, read by presentation.

## Suppliers

- `shared/ports/environment.ts`: a token handed to the run in a variable.
- `shared/ports/http-get.ts`: the identity check's request.
- `shared/`: errors, `Logger`, `AIDD_DIR`.

## Never

- Read a token variable or `auth.json` outside the context.
- Refuse a command for a missing token: `aidd_docs/memory/internal/auth.md` says where a 401 surfaces.
- Restate the source order: `sourcesInOrder` is described once in `aidd_docs/memory/internal/auth.md`.
