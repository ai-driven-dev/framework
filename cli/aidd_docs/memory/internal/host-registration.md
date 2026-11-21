# Host registration

What a host (Claude Code, Codex, Copilot) says it has registered, and the calls that change it. Language: `src/contexts/host-registration/glossary.md`; shape: `reference-context.md`; record rules: the `host-registration` rule page.

## Shape

- `contract/` is what an outside caller reads, `ports/` the host ports, `domain/` the rules and readings, `application/` the use cases.
- `infrastructure/` holds every reader, parser and the CLI adapter, imported by the composition root alone, which is also the one reader of `tools`' declarations.

## Ports

| Port | Answers | Real adapter |
| --- | --- | --- |
| `HostPluginRegistry` | which `<plugin>@<marketplace>` refs the host holds, and whether each is enabled | `plugin-registry-readers.ts` |
| `HostMarketplaceRegistry` | which marketplaces the host knows, by name and source | `marketplace-registry-reader.ts` |
| `HostMarketplaceSources` | what the host's own CLI says each marketplace points at | `marketplace-source-readers.ts` |
| `HostActions` | registers, enables, updates and removes through the host's CLI | `host-cli-adapter.ts` |

## Choosing a reader

- A tool never names itself here: its declared layout selects a reader from a `satisfies Record<Layout, ...>` table, so `tsc` refuses a layout with no row, and a new tool on an existing layout touches nothing here.
- Registry layouts are tables in `src/composition/host-registration.ts`; list layouts are the parsers in `infrastructure/marketplace-list-parsers.ts`.

## Reading and driving

- A reading is the refs or the reason there are none; `answeredRegistry` makes an unknown never a zero, and the Codex TOML is line-scanned.
- `HostCliAdapter` spawns the declared binary with a 120 second timeout.
- On Windows it runs `.cmd` and `.bat` launchers through a shell, quoted by `windowsCommandLine`.
- A scope becomes the host's flags through `scopeArgs`, and an uninstall uses the scope the plugin was enabled with.

## Tests

- Each port has one contract suite in `tests/contexts/host-registration/testing/`, run on its fake and its real adapter from `tests/contexts/host-registration/ports/`.
- The real `HostActions` and `HostMarketplaceSources` arms run a `#!/bin/sh` script on a narrowed `PATH`, so Windows skips them; the disabled case is skipped where the host records none (`recordsDisabled: false`).
- Mutation: one `host-registration` scope; `contract/` and `ports/` excluded.
