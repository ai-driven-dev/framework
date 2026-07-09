# Plan-status hedge

The plan's `status:` frontmatter refines the build-to-ship pin, so review is never skipped nor premature. `01-scan` reads it only when a plan exists.

| Plan `status:`          | Pin                          |
| ----------------------- | ---------------------------- |
| `in-progress`           | Implement alone              |
| `implemented`, or an open PR | Review, then commit/ship (Review first) |
| unreadable or absent    | Implement, then Review       |
