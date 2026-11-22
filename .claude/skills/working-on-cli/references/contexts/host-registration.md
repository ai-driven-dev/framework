# host-registration

What a host (Claude Code, Codex, Copilot) says it has registered, and the CLI calls that change it. Language: `src/contexts/host-registration/glossary.md`. Readers: `aidd_docs/memory/internal/host-registration.md`.

## Ports

- `HostPluginRegistry`, `HostMarketplaceRegistry`, `HostMarketplaceSources` read what the host holds; `HostActions` drives its CLI.

## Suppliers

- `shared/`: errors, scope, tool id. `tools/contract/`: readers take the profile through `ports/host-tool.ts`; composition picks each from the declared layout.

## Registration record

- What aidd asked a host to register: `binary`, `marketplaces`, `pluginRefs`, host data only (`domain/record/registration-record.ts`). The manifest stores it opaque beside its own claims; only this context reads or writes it, and orchestration hands installation the rules from `contract/registration-record-rules.ts`.
- A ref is `<plugin>@<host catalogue name>`: a qualified selector names one ref, a bare plugin name selects it in every catalogue.
- Removing a ref drops its claim; removing a marketplace drops its refs and claims; data naming no binary is no record.

## Never

- Name a tool id in the context: a new layout is a union member, a reader and a table line, forced by `tsc`.
- Spawn a host binary in a test: use a stub on a narrowed `PATH`.
