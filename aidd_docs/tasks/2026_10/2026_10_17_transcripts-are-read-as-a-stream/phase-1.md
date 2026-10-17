---
status: done
---

# Instruction: Tests first, red on `origin/next`

## Architecture projection

```txt
cli/tests/
├── contexts/telemetry/infrastructure/claude-transcript-source-adapter.integration.test.ts   ✏️ block-bounded reads, boundaries at a few bytes
├── contexts/telemetry/infrastructure/transcript-stream.property.integration.test.ts        ➕ S1 against the whole-tail oracle
├── contexts/telemetry/application/read-usage-use-case.integration.test.ts                 ✏️ lines reach the reader before the tail is read whole
├── contexts/telemetry/application/transcript-stream-ingest.property.integration.test.ts   ➕ S2: ledger, offsets, left-out, result byte for byte
└── helpers/whole-transcript-reader.ts                                                     ➕ the reader `origin/next` ships, as the oracle
```

## Steps

1. Copy the whole-tail reader of `origin/next` into a test helper, as the oracle.
2. Write the two behavioural guards (acceptance 1, 2) against the seams `origin/next` already has: the adapter's default constructor and `ReadUsageUseCase.execute`.
3. Run them on `origin/next`: record the red in `evidence.md`.
4. Write the boundary tests and S1, S2 against the new port.
