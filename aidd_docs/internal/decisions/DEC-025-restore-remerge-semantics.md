# Decision: Re-merge semantics for restore on merge files

| Field   | Value                       |
| ------- | --------------------------- |
| ID      | DEC-025                     |
| Date    | 2026-04-16                  |
| Feature | aidd restore merge files    |
| Status  | Accepted                    |

## Context

`aidd restore` previously ignored merge files (`.vscode/settings.json`, `.mcp.json`). These files are tracked with per-key hashes in `MergeFileEntry`. A naive full-overwrite restore would blow away user customizations that were intentionally preserved by the `user-prime` merge strategy on install/update.

## Decision

`RestoreUseCase.restoreMergeSection()` detects drift by comparing per-key hashes from the manifest against the current on-disk values. When drift is found, it calls `fs.mergeJsonFile(path, frameworkContent, strategy)` — re-applying the original merge rather than overwriting. After merge, `extractMergeEntries` recomputes hashes from the merged on-disk content and the manifest is updated.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Full overwrite | Simple | Destroys user-prime keys | Violates the merge contract established at install |
| Skip merge files entirely | No risk | Restore is incomplete — framework-prime drift goes undetected | Feature gap |

## Consequences

- Framework-prime keys (e.g. `github.copilot.enable`) are re-enforced on restore
- User-prime keys (e.g. `editor.fontSize`) are preserved even after restore
- Manifest hashes are refreshed to reflect the post-merge state on disk
- Drift detection is key-level, not file-level — only keys that drifted trigger a re-merge
