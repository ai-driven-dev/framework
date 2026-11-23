# update

The installed CLI against its latest release: decided, announced, replaced. Language: `src/contexts/update/glossary.md`.

## Ports

- `CliReleaseSource`: the latest release and its notes. `CliInstaller`: replaces the installed binary and answers the path it replaced. `UpdateCheckCache`: what the last check kept.
- Each has a contract kit in `tests/contexts/update/testing/`.

## Suppliers

- `auth/contract/token-provider.ts`: the token the changelog read sends (edge `update->auth`); the version read sends none.
- `shared/ports/http-get.ts`: the release reads, handed in by `src/composition/contexts/update.ts`, which also passes the bases of the reads ([self-update-version-source-npm.md](../../../../../cli/aidd_docs/memory/internal/decisions/self-update-version-source-npm.md)).
- `shared/`: errors, `Logger`, `VersionReader`, `FileReader`, `FileWriter`, semver.

## Never

- Spawn a process or read the clock in `application/`: the installer and the clock are handed in.
- Run a real package manager in a test: the installer's real arm runs against `tests/contexts/update/testing/stub-package-managers.fake.ts`.
- Change the notice text, the cache bytes or the variable names: the e2e suites and goldens freeze them.
