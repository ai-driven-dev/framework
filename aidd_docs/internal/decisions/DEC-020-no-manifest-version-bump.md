# Decision: No manifest version bump for mergeFiles

| Field   | Value                      |
| ------- | -------------------------- |
| ID      | DEC-020                    |
| Date    | 2026-04-09                 |
| Feature | per-entry hash tracking    |
| Status  | Accepted                   |

## Context

Adding `mergeFiles` to manifest `ToolEntry` could warrant a version bump (1→2). But no users have merge files in `files[]` in production — the feature was not yet released.

## Decision

Keep `version: 1`. Add `mergeFiles` as optional field (defaults to `[]` on load). No migration needed.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Bump to v2 + migration | Explicit versioning | Migration code for non-existent state | Dead code, over-engineering |
| Bump to v2 + reject v1 | Clean break | Breaks all existing users | Unacceptable UX |

## Consequences

Old manifests load with empty `mergeFiles`. Next install/update populates them. Zero breaking change.
