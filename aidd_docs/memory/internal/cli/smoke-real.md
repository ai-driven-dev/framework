# `smoke:real`

`cli/scripts/smoke-real.sh` is the one check reaching a real AI tool's own registry: opt-in, local, never in CI or lefthook.

- `cli/scripts/smoke-tools.sh` relocates `HOME`: it proves the CLI called a host, never that the host registered anything.

## Names

- Never the reserved `aidd-framework`: `setup` always takes it.
- `aidd-smoke-<epoch>-<pid>` is the project-scope name, `<that>-user` the machine-scope one; one name at both scopes collides.
- `--strict` refuses to run when `$HOME` already registers `aidd-framework`; the default `allow-existing` relies on the unique names.

## Environment

- `HOME` stays real.
- `AIDD_USER_CONFIG_DIR` moves into the run's temp root, exported before the first `aidd` call.
- `identity.json` follows it, in `<user config dir>/telemetry`; the script leaves `AIDD_TELEMETRY_DIR` unset.
- Every `--scope user` call passes `--no-default-marketplace`, or each host registers the reserved name.
- A tool absent from `PATH` is skipped, never failed.

## Phases

1. Files-only `setup`.
2. Native registration and `plugin install` under the project name, checked in each host's inventory, then `doctor`.
3. A host-side `claude plugin uninstall --scope local`, then the `sync --force` that repairs it.
4. Opencode's bridge.
5. Two `marketplace add` guards: another catalog under one name, and an alias diverging from the catalog's.
6. `setup --scope user`: the project stays clean per `git status --porcelain`, `doctor --scope user` is healthy.
7. Two projects sharing one machine-scope marketplace.
8. `clean --force` in the first, then `clean --scope user --force` and its no-user-manifest variant.

## Trap

- However the run ends, a trap runs `clean --force` per project, then `clean --scope user --force`.
- Only the user manifest records a machine-scope registration, so the trap recreates it first.

## Facts

- A project `clean --force` protects a `scope: "user"` registration by scope, not name: `cli/tests/orchestration/clean/clean-shared-ref-guard.codex-refs.integration.test.ts`.
- `clean --scope user --force` deletes only `aidd-framework`; another machine-scope entry survives, pointing at a removed `cache/built/`.
- A project `clean --force` removes the shared user-scope Cursor folder; `doctor` then reports its plugins missing until `aidd sync`.
