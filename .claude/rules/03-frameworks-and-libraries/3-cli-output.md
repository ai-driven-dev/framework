---
paths:
  - "src/application/**/*.ts"
---

# CLI Output

## Channels

- `stdout` — nominal output (info, success, print)
- `stderr` — signals (debug, warn, error)
- `Logger` (domain port) ≠ `CLIOutput` (command layer) — never mix
- Conflicts and skips → `warn`, never `error`
- `exit(1)` only after `output.error()` or `output.exit()`
- Final summary: one line — action + quantity + subject (e.g. `Installed 3 tools (42 files)`)

## CLIOutput contract

- Zero logic — only routes messages by log level
- No helper methods (formatBytes, formatCounts, etc.)
- Any formatting/transformation belongs in use-cases or domain models
