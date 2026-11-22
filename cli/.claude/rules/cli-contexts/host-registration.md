---
description: Apply when a host's own plugin or marketplace registry is read, or its CLI is driven to register, enable, update or remove; the host-registration context owns those facts and nothing else asks a host.
paths:
  - "src/contexts/host-registration/**/*.ts"
  - "src/composition/host-registration.ts"
  - "tests/contexts/host-registration/**/*.ts"
  - "src/orchestration/**/*.ts"
  - "src/contexts/installation/application/**/*.ts"
---

# Host registration

## Reason to change

- What a host (Claude Code, Codex, Copilot) says it has registered, and the CLI calls that change it. Its language is `src/contexts/host-registration/glossary.md`, its shape `reference-context.md`, its readers `aidd_docs/memory/internal/host-registration.md`.

## Ports

- `HostPluginRegistry`, `HostMarketplaceRegistry`, `HostMarketplaceSources` read what the host holds; `HostActions` drives its CLI.

## Suppliers

- `shared/`: errors, scope, tool id. `tools/contract/`: readers take the profile through `ports/host-tool.ts`, and composition picks each from the declared layout.

## Registration record

- The record is what aidd asked a host to register: `binary`, `marketplaces` and `pluginRefs`, host data only (`domain/record/registration-record.ts`). The manifest stores it as an opaque block beside its own claims on the refs; only this context reads or writes the record, and orchestration hands installation the rules each step needs from `contract/registration-record-rules.ts`.
- A ref is `<plugin>@<host catalogue name>`: a qualified selector names one ref, a bare plugin name selects it in every catalogue.
- Removing a ref drops its claim; removing a marketplace drops its refs and claims; data naming no binary is no record.

## Never

- Name a tool id in the context: a new layout is a union member, a reader and a table line, forced by `tsc`.
- Spawn a host binary in a test: use a stub on a narrowed `PATH`.
- Import `domain/`, `ports/` or `infrastructure/` from outside: callers read `contract/` only.
