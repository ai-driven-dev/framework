# `aidd update` reads the latest version from npm

Read before touching how `aidd update` finds a release.

## Decision

- The latest version comes from the public npm dist-tags of `@ai-driven-dev/cli`, the source `npm install -g` pulls from.
- The changelog is the GitHub release body of tag `cli-v<version>`, fetched best effort; a failure yields an empty changelog.
- Code: `cli/src/contexts/update/infrastructure/npm-registry-release-adapter.ts`.

## Why

- A GitHub release read fails without a token whenever the repository is private: GitHub answers 404.
- Requiring a token would force it on every user of a public npm package.

## Consequences

- Version resolution works for every user, with or without a token.
- The registry is hardcoded to `registry.npmjs.org`; a corporate npm mirror would need this revisited.
- Test overrides: `AIDD_SELF_UPDATE_NPM_BASE` and `AIDD_SELF_UPDATE_API_BASE`, wired in `cli/src/composition/contexts/update.ts`.
