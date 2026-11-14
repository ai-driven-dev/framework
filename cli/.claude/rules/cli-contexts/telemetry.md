---
description: Apply when a transcript line, a usage record, the ledger, consent, a declaration or a report changes; the telemetry context owns what a billed model call consumed, and nothing else counts it.
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
- Its language is `src/contexts/telemetry/glossary.md`; a name in the code means what that page says.
- Its shape follows `reference-context.md`, beside this page, bar the exceptions below. Where the code is: `aidd_docs/memory/telemetry.md`.

## Boundary

- Outside callers import `telemetry/contract/` only; presentation takes its types from there.
- A tool is one `UsageSource` (`list`, `read`, `decode(line, context?)`), registered once in `src/composition/telemetry.ts`. `decode` is a pure function of its line and the context the file's earlier lines returned. `ReadUsage` passes that context on and never reads it. A file's age is `read`'s, not the source's.
- Reading is one pass, tool-specific only up to the usage record. Resolving, storing, attributing and reporting are written once for every tool.
- Four stores are ports with a contract suite run against their fake and their real adapter: the usage ledger, the bindings lock, the binding snapshot store and the consent history. The other stores have no contract yet.

## Exceptions in force

- E-M1: `domain/legacy/legacy-locations.ts` keeps the paths an earlier version wrote, read only by `forget`.
- E-M2: the repository alias table is read, never written, at every load.
- Each is in section 9 of `reference-context.md`, with the line it deviates from and when it goes; the ambiguities this context settled are rows Tel-A1 to Tel-A6 there.

## Tests

- `tests/contexts/telemetry/`, mirroring the source, with the fakes and contract kits in `testing/`.
- A line format is pinned by real records, one fixture per observed format change: `tests/fixtures/claude-usage/` and `tests/fixtures/codex-usage/`, whose README gives the grouping rule. A line no reader classifies fails the replay: a Claude line by its unrecognised note, a Codex line by the declared list of line types.
- What a port promises is stated once, in its contract kit. An adapter's own test keeps only what its medium adds and no fake can show: file names, bytes, modes, torn lines, a lock file's content.

## Never

- Count a running total: only a call's own usage is a record.
- Keep state in a source between two lines: what a later line needs travels as the returned context.
- Name a tool in a store, the attribution or the report.
