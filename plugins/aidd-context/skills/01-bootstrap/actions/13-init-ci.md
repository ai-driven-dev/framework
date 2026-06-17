# 13 - Init CI

Wire continuous integration: a minimal pipeline that runs the project's quality gate and tests, green on the server. Conditional - skip when the project declares no CI platform.

## Inputs

- `INSTALL.md`
- `aidd_docs/vcs/memory`

## Process

1. Emit a minimal pipeline that runs the quality gate and the tests.
2. Commit, push
3. Confirm the run is green on the server.

## Test

- [ ] CI config committed.
- [ ] Pipeline is green on the server.
