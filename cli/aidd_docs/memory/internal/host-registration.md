# Host registration

What a host (Claude Code, Codex, Copilot) says it has registered, and the calls that change it. The context's language is `src/contexts/host-registration/glossary.md`; its shape is the `reference-context.md` rule.

## Shape

- `contract/` holds the four published ports and the pure rules over their types. There is no `domain/` folder: the rules are the whole domain (exception E11).
- `infrastructure/` holds every reader, parser and the CLI adapter. Only the composition root imports it.
- `src/composition/host-registration.ts` is the one reader of `tools`' declarations. It builds every reader from each tool's declared activation.

## Ports

| Port | Answers | Real adapter |
| --- | --- | --- |
| `HostPluginRegistry` | which `<plugin>@<marketplace>` refs the host holds, and whether each is enabled | `plugin-registry-readers.ts` |
| `HostMarketplaceRegistry` | which marketplaces the host knows, by name and source | `marketplace-registry-reader.ts` |
| `HostMarketplaceSources` | what the host's own CLI says each marketplace points at | `marketplace-source-readers.ts` |
| `HostActions` | registers, enables, updates and removes through the host's CLI | `host-cli-adapter.ts` |

## Choosing a reader

- A tool never names itself here. Its declared activation names a layout; the composition root maps each layout to a reader in a `satisfies Record<Layout, ...>` table.
- A new layout is a union member in `tools`, one reader, and one row in each of the three tables. `tsc` refuses the build until all three exist.
- A new tool on an existing layout touches no file of this context.

## Reading a registry

- A reading is the refs, or the reason there are none. An absent file, an unreadable one and a parsed empty one are three different answers.
- `answeredRegistry` turns a reading into refs or an `unanswerable` verdict naming the file. An unknown is never a zero.
- Copilot's registry is JSONC, opening with two `//` lines. A plain parse throws on it.

## Driving the host CLI

- `HostCliAdapter` spawns the declared binary with a 120 second timeout.
- On Windows it runs `.cmd` and `.bat` launchers through a shell, with the command line quoted by `windowsCommandLine`.
- Each call takes a scope and turns it into the host's own scope flags through the declared `scopeArgs`. A plugin uninstalled must use the scope it was enabled with, or the entry written is missed.

## Tests

- Each port has one contract suite in `tests/contexts/host-registration/testing/`, run on its fake and on its real adapter from `tests/contexts/host-registration/ports/`.
- The real `HostActions` and `HostMarketplaceSources` arms run a `#!/bin/sh` script on a narrowed `PATH`, so they are skipped on Windows. The repository fakes no `.cmd`.
- The plugin registry arm never simulates a registry that records no disabled state: the option `recordsDisabled: false` states it per layout.
- Mutation: `host-registration-rules` covers `contract/`, the only check on it since coverage excludes that folder. `host-registration-adapters` covers `infrastructure/`.
