# Plan-status hedge

The plan's `status:` frontmatter refines the build-to-ship pin, so review is never skipped nor premature.

| Plan `status:`               | Pin                                   |
| ---------------------------- | ------------------------------------- |
| `pending`                    | To implement                          |
| `in-progress`                | Implement alone                       |
| `implemented`                | Review                                |
| `reviewed`                   | Ship (commit, pull request)           |
| `blocked`                    | surface the blocker, not a normal pin |
| the field is missing or unreadable | Implement, then Review           |
