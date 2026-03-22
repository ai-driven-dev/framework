# Decision: Skip untracked user files during install and update

| Field   | Value                          |
| ------- | ------------------------------ |
| ID      | DEC-008                        |
| Date    | 2026-03-22                     |
| Feature | install / update user file protection |
| Status  | Accepted                       |

## Context

When running `aidd install` or `aidd update`, framework files are written to tool directories (`.claude/`, `.cursor/`, etc.). Users may already have files at those paths that were never installed by AIDD. Two distinct scenarios existed: fresh install (file not in manifest), and update introducing a new framework file that collides with a user file.

## Decision

In both `install` (`writeToolFiles`) and `update` (`applyDiff` for `added` entries): if a file exists on disk and is not tracked in the manifest (`isFileTracked` returns `false`), skip the write and emit a `logger.warn()`. The install/update continues normally for all other files. The skipped file is not added to the manifest.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Error and abort | Clear signal | Blocks entire install for one conflict | Too disruptive for a partial conflict |
| Backup then overwrite | No data loss | Leaves .bak files, intrusive | Inconsistent with adopt design: user files are never touched |
| Warn only, still overwrite | User informed | Data still lost | Defeats the purpose |

## Consequences

- User files at colliding paths are preserved unconditionally during install and update
- Skipped files appear as `+ added` in `aidd status` (untracked, not drift)
- Warning message names each skipped file so users know what was not installed
- Future write paths in any use-case must apply the same skip pattern
