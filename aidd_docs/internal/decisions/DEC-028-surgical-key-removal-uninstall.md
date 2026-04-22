# Decision: Surgical key removal for null-section merge files on uninstall

| Field   | Value                            |
| ------- | -------------------------------- |
| ID      | DEC-028                          |
| Date    | 2026-04-18                       |
| Feature | IDE-aware copilot settings       |
| Status  | Accepted                         |

## Context

Multiple tools can contribute keys to the same JSON file (e.g. `.vscode/settings.json`). When one tool is uninstalled, a full file deletion would destroy the other tool's contribution. The manifest tracks per-tool merge entries with per-key hashes, so the contributed keys are known precisely.

## Decision

On uninstall, for merge files where `sectionKey === null` (top-level JSON keys, not nested section entries like `mcpServers`): call `removeEntriesFromJson(content, null, Object.keys(entry.entries))` to remove only that tool's contributed keys. If no other installed tool has a merge entry for the same output path, delete the file entirely. Guard fix: `sharedPaths` guard is bypassed for null-section files so `removeNullSectionMergeFile` is always reached.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Delete entire file on any uninstall | Simple | Destroys other tools' contributions | Unacceptable data loss |
| Leave file untouched | Safe | Stale keys remain forever | Framework drift, user confusion |

## Consequences

- `removeEntriesFromJson(content, null, keys)` already handles the null-section case — no new function needed
- `sharedPaths` guard in `removeOneTool` must not skip null-section files — critical bug if missed
- File is deleted only when all owning tools are uninstalled — clean state guaranteed
