---
description: Apply when a transcript line, a usage record, the ledger, consent, a declaration or a report changes.
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
- Where the code is: `aidd_docs/memory/internal/telemetry.md`.

## Ports

- A tool is one `UsageSource` (`list`, `read`, `decode(line, context?)`), registered once in `src/composition/telemetry.ts`.
- `decode` is a pure function of its line and the context the file's earlier lines returned, which `ReadUsage` passes on and never reads.
- A file's age is `read`'s (`modifiedAt`), not the source's.
- The usage ledger, the bindings lock, the binding snapshot store and the consent history have a contract suite on fake and adapter.
- The other stores have none.
- An adapter's own test keeps only what its medium adds and no fake can show: file names, bytes, modes, torn lines, a lock file's content.

## Suppliers

- `shared/`: `Environment`, errors and the JSON readers of `domain/reading/`.
- Outside callers import `telemetry/contract/` and `telemetry/application/`, and the composition root reaches the rest: Biome denies `domain/`, `ports/` and `infrastructure/` (`HELD_BY_BIOME` in `tests/architecture/helpers.ts`).

## Never

- Count a running total: only a call's own usage is a record.
- Keep state in a source between two lines: what a later line needs travels as the returned context.
- Name a tool in a store, the attribution or the report.
- Pin a line format without a real record: one fixture per observed format change, and `tests/fixtures/codex-usage/README.md` gives the grouping rule.
- Leave a line no reader classifies: the replay fails a Claude line by its unrecognised note and a Codex line by the declared list of line types.
