---
status: done
---

# Instruction: The port hands lines one at a time

## Architecture projection

```txt
cli/src/contexts/telemetry/
├── domain/ports/transcript-source.ts                     ✏️ read(path, since, writtenFrom, each); no lines in TranscriptRead
├── infrastructure/claude-transcript-source-adapter.ts    ✏️ eachLine: a block at a time, up to the size stat'd
└── application/read-usage-use-case.ts                    ✏️ the loop body moves into `each`
cli/tests/helpers/ports/in-memory-telemetry.ts            ✏️ InMemoryTranscripts on the new port
```

## Steps

1. Change the port, the fake and the use case; run the telemetry suites.
2. Write `eachLine` in the adapter; run the adapter, S1 and S2 tests until green.
3. Prove each guard with a hand mutation; record it in `evidence.md`.
