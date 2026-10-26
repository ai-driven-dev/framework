---
status: done
---

# Instruction: Stored data migrated

```txt
cli/src/contexts/telemetry/
├── domain/legacy/repository-aliases.ts                  🆕 the table's format
├── domain/ports/repository-alias-store.ts                🆕 the table's store
├── infrastructure/legacy/repository-alias-store-adapter.ts 🆕 ledger/repository-ids.json
├── infrastructure/usage-ledger-adapter.ts               ✏️ load re-keys and re-ids, marks the partition unsettled
├── infrastructure/resolution-store-adapter.ts           ✏️ load re-ids
├── infrastructure/binding-snapshot-store-adapter.ts     ✏️ reads re-id
├── application/legacy/stored-usage-migration.ts         🆕 table, rewrite, complete
├── application/ingest-usage-use-case.ts                 ✏️ migration first, under the lock
└── ../../runtime/wiring/telemetry.ts                    ✏️ wired
```

| Case | Proof |
| --- | --- |
| migrated = fresh ingest, report and ledger bytes | fast-check property |
| twice = once; failure at every write then rerun = clean | same property |
| older CLI's lines after migration still fold | adapter test |
| `branches.jsonl` aliased at read, bytes untouched | adapter test |
