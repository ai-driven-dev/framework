# telemetry

What a tool's own transcripts say a model call consumed, and how it is stored, attributed and reported. Language: `src/contexts/telemetry/glossary.md`. Code map: [telemetry.md](../../../../../aidd_docs/memory/internal/cli/telemetry.md). Mutation floor applies: [mutation.md](../../../../../aidd_docs/memory/internal/cli/mutation.md).

## Ports

- A tool is one `UsageSource` (`list`, `read`, `decode(line, context?)`, `ports/usage-source.ts`), registered once in `src/composition/contexts/telemetry.ts`.
- `decode` is a pure function of its line and the context earlier lines returned; `ReadUsage` passes it on and never reads it. A file's age is `read`'s (`modifiedAt`), not the source's.
- The usage ledger, bindings lock, binding snapshot store and consent history have a contract suite on fake and adapter; the other stores have none.
- An adapter's own test keeps what its medium adds and no fake can show: file names, bytes, modes, torn lines, a lock file's content.

## Suppliers

- `shared/`: `Environment`, errors, the JSON readers of `domain/reading/`. Outside callers import `contract/` and `application/`; the composition root reaches the rest.

## Never

- Count a running total: only a call's own usage is a record.
- Keep state in a source between two lines: what a later line needs travels as the returned context.
- Pin a line format without a real record: one fixture per observed format change; the grouping rule is `tests/fixtures/codex-usage/README.md`.
- Leave a line no reader classifies: the replay fails a Claude line by its unrecognised note and a Codex line by the declared list of line types.

## Exceptions

- `domain/switch/legacy-locations.ts`, `domain/ledger/repository-aliases.ts`, `ports/repository-alias-store.ts` and `infrastructure/storage/ledger/repository-alias-store-adapter.ts` stay: `forget` erases what an earlier version stored, and attribution under an earlier repository id resolves only through `ledger/repository-ids.json`, never written. Removal is a maintainers' schedule (next major).
- `USAGE_TOOLS` in `contract/usage-record.ts` is the vocabulary of tools stored in a user's ledger, kept apart from `tools` (`STORED_VOCABULARY` in `tool-addition-cost.arch.test.ts`).
