---
paths:
  - "src/application/**/*.ts"
---

# CLI Output

- `stdout` — nominal output (info, success, print)
- `stderr` — signals (debug, warn, error)
- `Logger` (domain port) ≠ `CLIOutput` (command layer) — never mix
- Conflicts and skips → `warn`, never `error`
- `exit(1)` only after `output.error()` or `output.exit()`
- Final summary: one line — action + quantity + subject (e.g. `Installed 3 tools (42 files)`)
