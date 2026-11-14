# Telemetry glossary

The language of the `telemetry` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Usage record | One billed model call, counted once, with the counters the tool reported | `UsageRecord`, `contract/usage-record.ts` |
| Usage source | One tool's transcripts: which files exist, a file read from its saved offset, a line decoded. Registered once per tool | `UsageSource`, `ports/usage-source.ts` |
| Line context | What the earlier lines of a file settle for a later one, such as a Codex session and turn. Returned by `decode`, handed back by the reader, opaque to it | `LineUsage.context`, `CodexContext` |
| Unrecognised line | A line no reader classifies. Kept so a format change is seen, never silently dropped | `unrecognised` in `ReadUsage`'s result |
| Journal fixture | Real, anonymized records of one observed format, replayed by a test | `tests/fixtures/claude-usage/`, `tests/fixtures/codex-usage/` |
| Position | How far a transcript was read, saved so the next read starts there | `domain/transcript-position.ts` |
| Ledger | The stored records, one per call, upserted | `UsageLedger`, `ports/usage-ledger.ts` |
| Left out | A call measured but not storable, kept by hash so a report can say so | `ledger/left-out.txt` |
| Consent | Whether a clone allows its calls to be stored | `domain/telemetry-consent.ts`, `domain/consent/` |
| Declaration | The task a person named for the work that follows, bound to a branch or a session | `domain/declaration/`, `ports/bindings/` |
| Attribution | Which task, repository and person a call belongs to, derived at report time | `domain/report/attribution.ts` |
| Report | The totals of a period, split by one axis, as text or the versioned envelope | `contract/usage-report.ts`, `application/report/` |
