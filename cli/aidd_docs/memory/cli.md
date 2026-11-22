# CLI

## Commands

Read them live: `aidd --help`, then each group's; `tests/golden/help-surface.golden.test.ts` holds the surface.

| Command | Does |
| --- | --- |
| `setup`, `doctor`, `sync`, `clean` | bring a project to a correct state, check it, keep it there, remove it |
| `framework install, update, remove, rules, validate-recipes` | the framework alone on installed tools, and the recipes it ships |
| `plugin`, `marketplace` | the plugin and marketplace lifecycle of a project or the machine |
| `auth login, logout, status` | the one GitHub token |
| `telemetry` | local token measurement of Claude Code and Codex, mapped in `internal/telemetry.md` |
| `translate <source>` | author side: a source into a target-native plugin tree |
| `update`, alias `upgrade` | the CLI itself |

## Interface

- Parser: `commander`, in `src/cli.ts`.
- No argument on a TTY opens the interactive menu; without a TTY it prints help to stderr and exits 1.
- Global flags: `--version`, `--verbose` (or `AIDD_VERBOSE=true`).
- `--scope project|user` picks where a plugin or marketplace lives; `--global` makes `setup`, `doctor`, `sync` and `clean` run machine-wide.
- Channels and exit codes: [`references/architecture.md`](../../../.claude/skills/working-on-cli/references/architecture.md), Process.
- `doctor` drift is informational and never gates the exit code.
- `sync` restores tracked files, rewrites each tool's settings file, drives each host's native activation, then mirrors the proven plugins into the settings file; a user-scope run skips the restore and the settings-file steps.
- `clean` leaves the shared `aidd-framework` registration; `clean --scope user` purges it: [`clean-drives-the-host-cli.md`](internal/decisions/clean-drives-the-host-cli.md).

## Distribution

- npm bin `aidd` to `dist/cli.js`; `files` ships `dist` and the README.
- `npx @ai-driven-dev/cli@latest`, or a global install; build and publish in `deployment.md`.
- `AIDD_USER_CONFIG_DIR` relocates what is machine-owned, read by `src/composition/user-config-dir.ts`.
