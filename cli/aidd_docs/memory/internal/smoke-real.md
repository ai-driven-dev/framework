# `smoke:real`

`scripts/smoke-real.sh` is the one check that reaches a real AI-tool binary's own registry, and it is opt-in, local-only, never CI and never lefthook.

`smoke-tools.sh` relocates `HOME`, so it proves only that this CLI called a host, never that the host registered anything.

## Names

- The reserved `aidd-framework` is never used, because `setup`'s auto-register always takes it.
- `aidd-smoke-<epoch>-<pid>` names the project scope and `<that>-user` the machine scope, since one name at both scopes would collide on a host key.
- `--strict` refuses to run when a real `aidd-framework` registration exists in `$HOME`, and the default `--allow-existing` relies on the unique names.

## Environment

- `HOME` stays real.
- `AIDD_USER_CONFIG_DIR` is relocated into the run's temp root and exported before the first `aidd` call.
- `identity.json` follows it: it sits in the telemetry directory, `<user config dir>/telemetry`.
- `AIDD_TELEMETRY_DIR` is the separate override of that directory, and the script does not set it.
- Every `--scope user` call passes `--no-default-marketplace`, or `setup --scope user` registers the reserved name at every host.
- A tool whose binary is absent from `PATH` is skipped, never failed.

## Phases

1. Files-only `setup`.
2. Native registration and `plugin install` under the project-scope name, each host's own inventory where it has one (`claude plugin details`, `codex plugin list`, `copilot plugin list`), then `doctor`.
3. A host-side `claude plugin uninstall --scope local`, then the `sync --force` that repairs it.
4. Opencode's bridge.
5. Two `marketplace add` guards: a different catalog under one name, and an alias diverging from the catalog's.
6. `setup --scope user`, with the project clean per `git status --porcelain` and `doctor --scope user` healthy.
7. Two projects sharing one machine-scope marketplace.
8. `clean --force` in the first, then `clean --scope user --force` and its no-user-manifest variant.

## Trap

- A trap runs `clean --force` for every project created, then `clean --scope user --force`, however the run ends.
- Only the user manifest records a machine-scope registration, so the trap recreates it first, or a run dead before `sync --scope user` strands the registration at every host.

## Facts

- A project-scope `clean --force` protects a `scope: "user"` registration on the scope, not the name, as `tests/orchestration/clean/clean-shared-ref-guard.integration.test.ts` asserts.
- `clean --scope user --force` deletes the `aidd-framework` entry alone, so another machine-scope entry survives, pointing at a removed `cache/built/`.
- A project's `clean --force` removes the shared user-scope Cursor directory, so `doctor` reports its plugins not installed on this machine and `aidd sync` restores them.
