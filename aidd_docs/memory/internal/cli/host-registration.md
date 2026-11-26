# Host registration

What a host (Claude Code, Codex, Copilot, Kimi) says it registered, and the calls that change it. Language: `cli/src/contexts/host-registration/glossary.md`; record rules: the skill's [`references/contexts/host-registration.md`](../../../../.claude/skills/working-on-cli/references/contexts/host-registration.md).

## Ports

| Port | Answers | Real adapter |
| --- | --- | --- |
| `HostPluginRegistry` | which `<plugin>@<marketplace>` refs the host holds, and which are enabled | readers in `cli/src/contexts/host-registration/infrastructure/plugin-registry/` |
| `HostMarketplaceRegistry` | which marketplaces the host knows, by name and source | `cli/src/contexts/host-registration/infrastructure/marketplace/marketplace-registry-reader.ts` |
| `HostMarketplaceSources` | what the host's CLI says each marketplace points at | source readers in `cli/src/contexts/host-registration/infrastructure/marketplace/` |
| `HostActions` | register, enable, update and remove through the host's CLI | `cli/src/contexts/host-registration/infrastructure/host-cli-adapter.ts` |
| `HostPluginServer` | install, list and remove plugins through a server the host's CLI starts for one piece of work | `cli/src/contexts/host-registration/infrastructure/server/plugin-server-adapter.ts` |

- Only the composition root imports `infrastructure/`; it is also the one reader of `tools`' declarations.

## Choosing a reader

- A tool never names itself here: its declared layout selects a reader from a `satisfies Record<Layout, ...>` table.
- `tsc` refuses a layout with no row; a new tool on an existing layout touches nothing here.
- Registry layouts are tables in `cli/src/composition/contexts/host-registration.ts`; list layouts are parsers in `cli/src/contexts/host-registration/infrastructure/marketplace/marketplace-list-parsers.ts`.

## Reading and driving

- A reading is the refs or the reason there are none; `answeredRegistry` keeps an unknown from reading as zero.
- The Codex TOML is line-scanned.
- `HostCliAdapter` spawns the declared binary with a 120 second timeout.
- On Windows, `.cmd` and `.bat` launchers run through a shell, quoted by `windowsCommandLine`.
- `scopeArgs` turns a scope into host flags; an uninstall uses the scope the plugin was enabled with.

## Plugin server

- A host with no plugin verbs declares a `pluginServer` in its native-registration section; selection is by that declaration, never by tool id.
- The token is read from the server's startup banner and never stored or logged. `ServerPluginLedger` records which plugins aidd installed, beside the machine manifest.
- A user-scope run installs from the framework's built tree; `clean --scope user` removes what the ledger holds and refuses when the host's binary is gone. `plugin remove` and `plugin update` at user scope reach the ledger too; `plugin install --scope user` cannot target such a tool, whose install scope is the project's.

## Tests

- Each port has one contract suite in `cli/tests/contexts/host-registration/testing/`, run on its fake and its real adapter. The server's real arm replays `tests/fixtures/hosts/kimi-0.42.0/server-exchanges.json`.
- The real `HostActions` and `HostMarketplaceSources` arms run a `#!/bin/sh` script on a narrowed `PATH`: Windows skips them.
- The disabled case is skipped where the host records none (`recordsDisabled: false`).
- Mutation: one `host-registration` scope; `ports/` is excluded.
