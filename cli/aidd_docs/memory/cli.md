# CLI

## Commands

Read them live: `aidd --help`, then each group's; `tests/golden/help-surface.golden.test.ts` holds the surface.

| Command | Does |
| --- | --- |
| `setup`, `doctor`, `sync`, `clean` | bring a project to a correct state, check it, keep it there, remove it |
| `framework install, update, remove, rules, validate-recipes` | a tool's configuration, chosen by `--tool <id>` |
| `plugin`, `marketplace` | the plugin and marketplace lifecycle of a project or the machine |
| `auth login, logout, status` | the one GitHub token |
| `telemetry` | local token measurement of Claude Code and Codex, mapped in `internal/telemetry.md` |
| `translate <source>` | author side: a source into a target-native plugin tree |
| `update`, alias `upgrade` | the CLI itself |

## Interface

- Parser: `commander`, in `src/cli.ts`.
- No argument on a TTY opens the interactive menu; without a TTY it prints help.
- Global flags: `--version`, `--verbose` (or `AIDD_VERBOSE=true`).
- `--scope project|user` picks where a plugin or marketplace lives; `--global` makes `setup`, `doctor`, `sync` and `clean` run machine-wide.
- Text goes to stdout, warnings and errors to stderr (`src/presentation/output.ts`).
- Exit `0` ok; `1` on an error, an invalid `--scope`, or a `doctor` structural issue.
- `doctor` drift is informational and never gates the exit code.
- `sync` restores tracked files, then drives each host's native activation.
- `clean` leaves the shared `aidd-framework` registration; `clean --scope user` purges it: [`clean-drives-the-host-cli.md`](internal/decisions/clean-drives-the-host-cli.md).

## Distribution

- npm bin `aidd` to `dist/cli.js`; `files` ships `dist` and the README.
- `npx @ai-driven-dev/cli@latest`, or a global install; build and publish in `deployment.md`.
- `AIDD_USER_CONFIG_DIR` relocates what is machine-owned, read by `src/shared/infrastructure/user-config-dir.ts`.
