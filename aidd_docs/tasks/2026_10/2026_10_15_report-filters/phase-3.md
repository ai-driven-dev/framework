---
status: done
---

# Instruction: The command and the text say what was selected

## Architecture projection

```txt
cli/src/presentation/commands/telemetry.ts                         ✏️ nine flags, one parser each (choices + no repeat), trim, conflicts, exit codes
cli/src/presentation/display/telemetry/telemetry-report-display.ts ✏️ header line of filters; "no call matches" message
cli/tests/… command and display tests                              ✏️
scripts/check-claude-tokens-end-to-end.cjs                         ✏️ one filtered report
```

## Tasks

### `1)` Red first

1. Each error exits 1 naming the flag: repeated flag (open and closed sets), value empty once trimmed, unknown choice, `--unattributed` with `--task`/`--ticket`/`--absent ticket`, ambiguous prefix (candidates listed), `.` outside a repository.
2. `--unattributed` bare => `any`; `--unattributed any|no-binding|declared-none` accepted.
3. Text: header names each filter as its row labels it; no match => message, exit 0.
4. Record red output.

### `2)` Code

Thin wrapper per `cli/.claude/skills/command`: parse, guard, one use case, display.

## Acceptance

| Task | Criterion |
| ---- | --------- |
| 1 | red first |
| 2 | green; help text lists the flags |
