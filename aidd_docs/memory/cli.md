# CLI

The `aidd` binary, built from `cli/` and published to npm as `@ai-driven-dev/cli`.

- Before editing anything under `cli/`, load the `working-on-cli` skill and follow the action for your change.
- CLI detail is on demand under `internal/cli/`; per-context rules are in the `working-on-cli` skill's references.

## Commands

- `aidd --help` is the only list that stays true; summary in `internal/cli/commands.md`.
- `setup --provider` picks the provider of the main session and each tool's agents, machine-wide: [agent guide](../../docs/SUBAGENTS.md#-models).
- `telemetry` counts Claude Code and Codex tokens locally: [usage contract](../product/usage-contract.md).

## Interface

- Node, ESM, Commander. The Node floor is `engines` in `cli/package.json`.

## Distribution

- npm with OIDC publishing: `internal/deployment.md`, `internal/cli/deployment.md`.
