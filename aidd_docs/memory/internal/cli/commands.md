# CLI Commands

Read them live with `aidd --help`; `cli/tests/golden/help-surface.golden.test.ts` holds the surface.

| Command | Does |
| --- | --- |
| `setup`, `doctor`, `sync`, `clean` | bring a project to a correct state, check it, keep it there, remove it |
| `framework install, update, remove, rules, validate-recipes` | the framework alone on installed tools, and its recipes |
| `plugin`, `marketplace` | plugin and marketplace lifecycle, per project or machine |
| `auth login, logout, status` | the one GitHub token: [`auth.md`](auth.md) |
| `telemetry` | local token measurement: [`telemetry.md`](telemetry.md) |
| `translate <source>` | author side: a source into a target-native plugin tree |
| `update`, alias `upgrade` | the CLI itself |

## Interface

- Parser: `commander`, in `cli/src/cli.ts`.
- No argument on a TTY opens the menu; without a TTY, help goes to stderr and the exit is 1.
- Global flags: `--version`, `--verbose` (or `AIDD_VERBOSE=true`).
- `--scope project|user` picks where a plugin or marketplace lives.
- `--global` runs `setup`, `doctor`, `sync` and `clean` machine-wide.
- Channels and exit codes: the skill's [`references/architecture.md`](../../../../.claude/skills/working-on-cli/references/architecture.md), Process.
- `doctor` drift is informational; it never gates the exit code.
- `sync` restores tracked files, rewrites settings, drives native activation, then mirrors proven plugins into settings.
- A user-scope `sync` skips the restore and the settings steps.
- `clean` leaves the shared `aidd-framework` registration; `clean --scope user` purges it: [`decisions/clean-drives-the-host-cli.md`](decisions/clean-drives-the-host-cli.md).
- `AIDD_USER_CONFIG_DIR` relocates machine-owned state, read by `cli/src/composition/user-config-dir.ts`.

### Targeted user-scope `plugin update`

- A plugin file-copied for the tool (Cursor, for one) is rematerialized from the built tree (`update-plugin.use-case.ts`, `planFiles`).
- A native ref goes to the host's own CLI, and `RefreshHostPlugin` refuses a tool whose activation spec has no `updateVerb` (`refresh-host-plugin.use-case.ts:42`).
- Only Copilot declares `updateVerb` (`tool-profiles/copilot.ts:107`): native `plugin update <plugin>@<catalogue>`, naming dependent projects, with no hand-written host cache.
- Claude (`claude.ts:88-94`) and Codex (`codex.ts:98-100`) declare an activation without it, so they refuse; use `marketplace refresh` or `framework update`.

## Distribution

- npm bin `aidd`, built to `dist/cli.js`; `files` ships `dist` and the README.
- Run it with `npx @ai-driven-dev/cli@latest` or a global install; build and publish: [`deployment.md`](deployment.md).
