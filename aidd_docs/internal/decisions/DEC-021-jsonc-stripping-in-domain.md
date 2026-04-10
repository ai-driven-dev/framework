# Decision: JSONC stripping in domain extractMergeEntries

| Field   | Value                      |
| ------- | -------------------------- |
| ID      | DEC-021                    |
| Date    | 2026-04-10                 |
| Feature | per-entry hash tracking    |
| Status  | Accepted                   |

## Context

Framework config files (e.g. `.vscode/settings.json`) contain JSONC (comments + trailing commas). `extractMergeEntries` receives raw framework content before disk merge. `JSON.parse` fails silently on JSONC, producing empty entries.

## Decision

Add `stripComments()` in `merge-entry.ts` (domain). Duplicates logic from `file-system-adapter.ts` but keeps domain self-contained.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Strip in distribution before GeneratedFile | Clean single point | Changes file hashes, broad impact | Too risky for this scope |
| Import from adapter | No duplication | Domain imports infra | Hexagonal violation |
| Shared util | DRY | New shared layer | Over-engineered for one function |

## Consequences

Duplication between domain and infra (~40 lines). Acceptable trade-off. Future refactor could extract to a shared pure function.
