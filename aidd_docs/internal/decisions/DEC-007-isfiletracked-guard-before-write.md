# Decision: isFileTracked() as guard before writing untracked file

| Field   | Value                          |
| ------- | ------------------------------ |
| ID      | DEC-007                        |
| Date    | 2026-03-22                     |
| Feature | install / update user file protection |
| Status  | Accepted                       |

## Context

`install` and `update` both call `fs.writeFile()` unconditionally when writing framework files. If a user already has a file at the same path (not installed by AIDD), it would be silently overwritten. The `Manifest` had no method to check whether a given path was owned by AIDD across all sections.

## Decision

Add `isFileTracked(relativePath: string): boolean` to `Manifest`. It checks `_tools`, `_docs`, and `_scripts` entries. This method is the single authoritative guard before any write: if a file exists on disk and `isFileTracked` returns `false`, the file belongs to the user and must not be written.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Directory-level check only | Simple | Misses per-file conflicts | Too coarse — directory can exist with user files alongside framework files |
| Backup before overwrite | No data loss | Intrusive, leaves .bak files | Inconsistent with adopt philosophy: user files are never touched |

## Consequences

- Any future `fs.writeFile()` on a framework file must be preceded by `isFileTracked()` check
- `Manifest` is now the canonical oracle for "does AIDD own this path?"
- Adding new write paths in use-cases requires the same guard pattern
