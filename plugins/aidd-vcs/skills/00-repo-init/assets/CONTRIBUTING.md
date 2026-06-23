# Contributing to {{PROJECT_NAME}}

## Setup

See `INSTALL.md`.

## Workflow

1. Branch off the default branch.
2. Implement against the wired route stubs - keep architecture boundaries (see `INSTALL.md`).
3. Add or extend tests alongside the code (see `INSTALL.md` for how to run them).
4. Run the suite before opening a request.

## Conventions

- Commits: conventional commits (`<type>(<scope>): description`).
- The CI pipeline runs the test suite on every push; keep it green.
- Do not put business logic in route stubs until you replace them with real handlers.
