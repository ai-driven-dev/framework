---
description: Apply when a host's own plugin or marketplace registry is read, or its CLI is driven to register, enable, update or remove; the host-registration context owns those facts and nothing else asks a host.
paths:
  - "src/contexts/host-registration/**/*.ts"
  - "src/composition/host-registration.ts"
  - "tests/contexts/host-registration/**/*.ts"
  - "src/contexts/framework/application/**/*.ts"
---

# Host registration

## Reason to change

- What a host (Claude Code, Codex, Copilot) says it has registered, and the CLI calls that change it.
- Which registry file, reader and list parser a tool uses comes from its declared `location`, never from a tool id: `src/composition/host-registration.ts`.
- Its language is `src/contexts/host-registration/glossary.md`.
- Its shape is the reference: `reference-context.md`, beside this page.

## Ports

- `HostPluginRegistry`, `HostMarketplaceRegistry`, `HostMarketplaceSources`: read what the host holds.
- `HostActions`: drive the host's own CLI.
- All four are published in `contract/`, with the pure rules over their types: `answeredRegistry`, `marketplaceSourceConflict`, `pluginSetDifference`, `describePluginDiff` (exception E11).

## Suppliers

- `shared/`: errors, scope, tool id.
- `src/composition/host-registration.ts`: the only reader of `tools`' declarations.

## Never

- Name a tool id in the context: a new layout is a union member, a reader and a table line, forced by `tsc`.
- Spawn a host binary in a test: a stub binary on a narrowed `PATH`.
- Import `domain/` or `infrastructure/` from outside: framework reads `contract/` only.
