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
- Its language is `src/contexts/update/glossary.md`; a name in the code means what that page says.
- Its shape is the strict reference: `reference-context.md`, beside this page.

## Ports

- `CliReleaseSource`: the latest release of the CLI and its notes.
- `CliInstaller`: replaces the installed binary, answers the path it replaced.
- `UpdateCheckCache`: what the last check kept, read and written.

## Suppliers

- `shared/ports/http-get.ts`: the two reads of a release, handed in by `src/composition/update.ts`.
- `auth/contract/token-provider.ts`: the token the changelog read may carry (edge `update -> auth`).
- `shared/ports/environment.ts`: the two bases that point the reads elsewhere for tests.
- `kernel/`: errors, `Logger`, `VersionReader`, semver (migration state M3 of the reference).

## Never

- Spawn a process or read the clock in `application/`: the installer and the clock are handed in.
- Run a real package manager in a test: the installer's real arm resolves stubs on a `PATH` that is the stub directory, and proves it before installing.
- Change the notice text, the cache bytes or the variable names: the e2e suite and the goldens freeze them.
