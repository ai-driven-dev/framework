# 11 - Init containers

Make the project's runtime reproducible: a container/compose definition that ups and downs cleanly. Conditional - skip when `INSTALL.md` declares no container/runtime.

## Inputs

- Whether the project is containerized - a deployment decision in `INSTALL.md` (no Dockerfile exists yet to read it from).
- The running app and its datastores (`06-init-dependencies`, `08-init-database`) to containerize.

## Process

1. Write the container / compose definition for the project's runtime (app + its datastores).
2. Bring it up.
3. Prove the app responds.
4. Bring it down cleanly.

## Test

- [ ] Up: app responds.
- [ ] Down: clean teardown, no orphaned container/volume.
