---
description: Apply when a transcript line, a usage record, the ledger, consent, a declaration or a report changes. The telemetry context owns what a billed model call consumed, and nothing else counts it.
paths:
  - "src/contexts/telemetry/**/*.ts"
  - "src/composition/telemetry.ts"
  - "tests/contexts/telemetry/**/*.ts"
  - "tests/fixtures/claude-usage/**"
  - "tests/fixtures/codex-usage/**"
---

# Telemetry

## Reason to change

- What a tool's own transcripts say a model call consumed, and how that is stored, attributed and reported.
- Its language is `src/contexts/telemetry/glossary.md`, its shape `reference-context.md` bar the exceptions listed there.
- Where the code is: the telemetry page of the memory bank.

## Ports

- A tool is one `UsageSource` (`list`, `read`, `decode(line, context?)`), registered once in `src/composition/telemetry.ts`.
- `decode` is a pure function of its line and the context the file's earlier lines returned, which `ReadUsage` passes on and never reads.
- Four stores have a contract suite on fake and adapter: the usage ledger, the bindings lock, the binding snapshot store and the consent history.

## Suppliers

- `shared/`: `Environment`, errors and the JSON readers of `domain/reading/`.
- Outside callers import `telemetry/contract/` only.

## Never

- Count a running total: only a call's own usage is a record.
- Keep state in a source between two lines: what a later line needs travels as the returned context.
- Name a tool in a store, the attribution or the report.
- Pin a line format without a real record: one fixture per observed format change, grouped by the README beside them.
