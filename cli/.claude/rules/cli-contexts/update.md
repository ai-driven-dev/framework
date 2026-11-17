---
description: Apply when the CLI replaces itself or tells a person a newer release exists; the update context owns both, and nothing else reads the check cache.
paths:
  - "src/contexts/update/**/*.ts"
  - "src/composition/update.ts"
  - "tests/contexts/update/**/*.ts"
---

# Update

## Reason to change

- The installed CLI against its latest release: decided, announced, replaced.
- Its language is `src/contexts/update/glossary.md`, its shape `reference-context.md`.

## Ports

- `CliReleaseSource`: the latest release of the CLI and its notes.
- `CliInstaller`: replaces the installed binary and answers the path it replaced.
- `UpdateCheckCache`: what the last check kept, read and written.
- Each has a contract kit in `tests/contexts/update/testing/`.

## Suppliers

- `auth/contract/token-provider.ts`: the token a release read may carry (edge `update->auth`).
- `shared/ports/http-get.ts`: the release reads, handed in by `src/composition/update.ts`.
- `src/composition/update.ts` passes in the bases read from `AIDD_SELF_UPDATE_API_BASE` and `AIDD_SELF_UPDATE_NPM_BASE`, which point the reads elsewhere for tests.
- `shared/`: errors, `Logger`, `VersionReader`, semver.

## Never

- Spawn a process or read the clock in `application/`: the installer and the clock are handed in.
- Run a real package manager in a test: the installer's real arm runs against the stubs of `stub-package-managers.ts`.
- Change the notice text, the cache bytes or the variable names: the e2e suites and the goldens freeze them.
