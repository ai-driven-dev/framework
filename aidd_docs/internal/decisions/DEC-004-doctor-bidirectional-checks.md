---
name: decision
description: Doctor covers both manifest→disk and disk→manifest directions
argument-hint: N/A
---

# Decision: doctor checks both directions manifest↔disk

| Field   | Value                          |
| ------- | ------------------------------ |
| ID      | DEC-004                        |
| Date    | 2026-03-19                     |
| Feature | doctor-signal-detection        |
| Status  | Accepted                       |

## Context

`DoctorUseCase` had a gap: `checkBrokenReferences` silently skipped files missing from disk (`continue` on `!fileExists`). Tracked files absent on disk were invisible to the user. The check order also put orphan detection before missing file detection, which is unintuitive.

## Decision

Doctor runs four checks in order of severity:

1. `checkDocsDirectory` — docs dir exists
2. `checkMissingTrackedFiles` — manifest → disk (tracked files present on disk?)
3. `checkBrokenReferences` — internal cross-references valid?
4. `checkOrphanedDirectories` — disk → manifest (untracked aidd files detected?)

Missing tracked files surface as `severity: "error"`, orphaned dirs as `"warning"`. The doctor command respects severity when outputting (`output.error()` vs `output.warn()`).

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Keep silent skip in `checkBrokenReferences` | No change | Manifest→disk gap invisible | User can't diagnose missing files |
| Single combined check | Fewer methods | Mixed concerns, hard to reason about | Clarity over brevity |

## Consequences

- Users see explicit errors when tracked files are deleted from disk
- `aidd restore` is the suggested fix for missing tracked files
- Severity distinction (`error` vs `warning`) is meaningful and rendered correctly in CLI output
