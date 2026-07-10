# Plan-status hedge

The plan's `status:` frontmatter refines the build-to-ship pin, so review is never skipped nor premature.

| Plan `status:`               | Pin                                   |
| ---------------------------- | ------------------------------------- |
| `pending`                    | Implement (not started yet)           |
| `in-progress`                | Implement alone                       |
| `implemented`, or an open PR | Review, then ship (Review first)      |
| `reviewed`                   | Ship (commit, pull request)           |
| `blocked`                    | surface the blocker, not a normal pin |
| unreadable or absent         | Implement, then Review                |
